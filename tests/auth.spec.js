const {test, expect} = require('@playwright/test');

test('auth foundation starts unavailable without config while guest features initialize', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#readerContent [data-verse-number]')).not.toHaveCount(0);
  await expect(page.locator('#planDays .plan-day')).toHaveCount(30);
  await expect.poll(() => page.evaluate(() => God4Auth.getState().status)).toBe('unavailable');
  await page.locator('#heroFav').click();
  await expect(page.locator('#savedCount')).toHaveText('1');
  await page.getByRole('button', {name: 'Compare'}).click();
  await expect(page.locator('#view-compare')).toHaveClass(/active/);
});

test('auth foundation restores guest or a safe signed-in identity and notifies subscribers', async ({page}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const states = [];
    const guest = createGod4Auth({initialize: async () => null, subscribe: () => () => {}});
    const unsubscribe = guest.subscribe(state => states.push(state.status));
    await guest.initialize();
    unsubscribe();
    const signedIn = createGod4Auth({
      initialize: async () => ({id: 'user-1', email: 'reader@example.test', access_token: 'hidden'}),
      subscribe: () => () => {}
    });
    await signedIn.initialize();
    const state = signedIn.getState();
    state.user.email = 'mutated';
    return {states, guest: guest.getState(), signedIn: signedIn.getState()};
  });
  expect(result.states).toEqual(['restoring', 'guest']);
  expect(result.guest).toEqual({status: 'guest', user: null, recovery: false});
  expect(result.signedIn).toEqual({status: 'signed-in', user: {id: 'user-1', email: 'reader@example.test'}, recovery: false});
});

test('auth foundation provider failure leaves Reader and local features usable', async ({page}) => {
  await page.route('**/js/vendor/supabase-js-2.117.0.min.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: 'window.supabase = {createClient() { throw new Error("Unavailable"); }};'
  }));
  await page.route('**/js/auth/config.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: 'var God4AuthConfig={enabled:true,supabaseUrl:"https://example.supabase.co",publishableKey:"test-public",allowedHosts:["127.0.0.1"],allowedOrigins:["http://127.0.0.1:4173"],callbackPath:"/auth/callback/"};'
  }));
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => God4Auth.getState().status)).toBe('unavailable');
  await expect(page.locator('#readerContent [data-verse-number]')).not.toHaveCount(0);
  await expect(page.locator('#planDays .plan-day')).toHaveCount(30);
  await page.locator('#heroFav').click();
  await expect(page.locator('#savedCount')).toHaveText('1');
  const result = await page.evaluate(async () => {
    const auth = createGod4Auth({initialize: async () => { throw new Error('Offline'); }, subscribe: () => () => {}});
    await auth.initialize();
    return auth.getState().status;
  });
  expect(result).toBe('unavailable');
});

test('auth foundation uses one provider subscription and handles sign-in and sign-out events', async ({page}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    let callback;
    let subscriptions = 0;
    const auth = createGod4Auth({
      initialize: async () => null,
      subscribe(listener) { callback = listener; subscriptions++; return () => {}; },
      signOut: async () => {}
    });
    const first = auth.initialize();
    const second = auth.initialize();
    await Promise.all([first, second]);
    callback({type: 'signed-in', user: {id: 'user-2', email: 'new@example.test'}});
    const signedIn = auth.getState();
    callback({type: 'signed-out'});
    return {subscriptions, samePromise: first === second, signedIn, signedOut: auth.getState()};
  });
  expect(result.subscriptions).toBe(1);
  expect(result.samePromise).toBe(true);
  expect(result.signedIn.status).toBe('signed-in');
  expect(result.signedOut).toEqual({status: 'guest', user: null, recovery: false});
});

test('auth foundation ignores stale restoration and sign-in after sign-out', async ({page}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    let callback;
    let finishRestore;
    const auth = createGod4Auth({
      initialize: () => new Promise(resolve => { finishRestore = resolve; }),
      subscribe(listener) { callback = listener; return () => {}; },
      signOut: async () => {}
    });
    const restoring = auth.initialize();
    await Promise.resolve();
    await auth.signOut();
    finishRestore({id: 'old-user', email: 'old@example.test'});
    await restoring;
    callback({type: 'restored', user: {id: 'old-user'}});
    callback({type: 'signed-in', user: {id: 'old-user'}});
    return auth.getState();
  });
  expect(result).toEqual({status: 'guest', user: null, recovery: false});
});

test('provider sign-out supersedes pending sign-in and immediate-session signup', async ({page}) => {
  await page.goto('/');
  const states = await page.evaluate(async () => {
    const snapshots = [];
    for(const action of ['signIn', 'signUp']){
      let notify;
      let finish;
      const auth = createGod4Auth({
        initialize: async () => null,
        subscribe(listener) { notify = listener; return () => {}; },
        signIn: () => new Promise(resolve => { finish = resolve; }),
        signUp: () => new Promise(resolve => { finish = resolve; })
      });
      await auth.initialize();
      const pending = action === 'signIn' ? auth.signIn('reader@example.test', 'password') :
        auth.signUp('reader@example.test', 'password');
      notify({type: 'signed-out'});
      finish(action === 'signIn' ? {id: 'stale-user'} :
        {user: {id: 'stale-user'}, signedIn: true, needsConfirmation: false});
      await pending;
      snapshots.push(auth.getState().status);
    }
    return snapshots;
  });
  expect(states).toEqual(['guest', 'guest']);
});
test('auth foundation keeps a newer event subscription when restoration fails', async ({page}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    let callback;
    let unsubscribeCount = 0;
    const auth = createGod4Auth({
      initialize: async () => { throw new Error('Old restore failed'); },
      subscribe(listener) { callback = listener; return () => { unsubscribeCount++; }; }
    });
    const restoring = auth.initialize();
    callback({type: 'signed-in', user: {id: 'new-user'}});
    await restoring;
    callback({type: 'signed-out'});
    return {unsubscribeCount, state: auth.getState()};
  });
  expect(result).toEqual({unsubscribeCount: 0, state: {status: 'guest', user: null, recovery: false}});
});

test('auth foundation failed sign-in during restoration returns to guest state', async ({page}) => {
  await page.goto('/');
  const state = await page.evaluate(async () => {
    let finishRestore;
    const auth = createGod4Auth({
      initialize: () => new Promise(resolve => { finishRestore = resolve; }),
      subscribe: () => () => {},
      signIn: async () => { throw new Error('Wrong password'); }
    });
    const restoring = auth.initialize();
    await Promise.resolve();
    try { await auth.signIn('reader@example.test', 'wrong'); } catch(error) {}
    finishRestore({id: 'stale-user'});
    await restoring;
    return auth.getState();
  });
  expect(state).toEqual({status: 'guest', user: null, recovery: false});
});
test('auth foundation delegates actions without touching existing user data', async ({page}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const keys = ['god4.savedVerses', 'god4.plan.completedDays', 'god4.translation',
      'god4.compare', 'god4.reader.position', 'god4.speech.speed', 'god4.speech.voice'];
    const before = keys.map(key => localStorage.getItem(key));
    const calls = [];
    const auth = createGod4Auth({
      initialize: async () => null,
      subscribe: () => () => {},
      signUp: async (email, password) => { calls.push(['signUp', email, password]); return {user: {id: 'user-3'}, signedIn: false, needsConfirmation: true}; },
      signIn: async (email, password) => { calls.push(['signIn', email, password]); return {id: 'user-3', email}; },
      signOut: async () => { calls.push(['signOut']); },
      requestPasswordReset: async email => { calls.push(['requestPasswordReset', email]); },
      completePasswordReset: async password => { calls.push(['completePasswordReset', password]); return {id: 'user-3'}; }
    });
    await auth.initialize();
    const signup = await auth.signUp('reader@example.test', 'password-one');
    await auth.signIn('reader@example.test', 'password-two');
    await auth.requestPasswordReset('reader@example.test');
    await auth.completePasswordReset('password-three');
    await auth.signOut();
    return {calls, signup, state: auth.getState(), before, after: keys.map(key => localStorage.getItem(key))};
  });
  expect(result.calls.map(call => call[0])).toEqual(['signUp', 'signIn', 'requestPasswordReset', 'completePasswordReset', 'signOut']);
  expect(result.signup.needsConfirmation).toBe(true);
  expect(result.state.status).toBe('guest');
  expect(result.after).toEqual(result.before);
});

test('auth foundation Supabase adapter maps events and returns no tokens', async ({page}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    let callback;
    const events = [];
    const calls = [];
    const user = {id: 'user-4', email: 'reader@example.test', access_token: 'hidden'};
    const client = {auth: {
      getSession: async () => ({data: {session: {user, access_token: 'hidden'}}, error: null}),
      onAuthStateChange(listener) { callback = listener; return {data: {subscription: {unsubscribe() { calls.push('unsubscribe'); }}}}; },
      signUp: async credentials => { calls.push(['signup-redirect', credentials.options.emailRedirectTo]);
        return {data: {user, session: null}, error: null}; },
      signInWithPassword: async () => ({data: {user, session: {user}}, error: null}),
      signOut: async () => ({error: null}),
      resetPasswordForEmail: async (email, options) => { calls.push(['reset', email, options.redirectTo]); return {error: null}; },
      updateUser: async () => ({data: {user}, error: null})
    }};
    const provider = SupabaseAuthProvider.create({enabled: true, supabaseUrl: 'https://example.supabase.co',
      publishableKey: 'test-public', allowedHosts: [location.hostname],
      allowedOrigins: [location.origin], callbackPath: '/auth/callback/'}, client);
    const unsubscribe = provider.subscribe(event => events.push(event));
    const restored = await provider.initialize();
    callback('INITIAL_SESSION', {user});
    callback('SIGNED_IN', {user});
    callback('PASSWORD_RECOVERY', {user});
    callback('SIGNED_OUT', null);
    const signup = await provider.signUp('reader@example.test', 'password');
    const signedIn = await provider.signIn('reader@example.test', 'password');
    await provider.requestPasswordReset('reader@example.test');
    const updated = await provider.completePasswordReset('password');
    await provider.signOut();
    unsubscribe();
    return {events, restored, signup, signedIn, updated, calls};
  });
  expect(result.events.map(event => event.type)).toEqual(['restored', 'signed-in', 'recovery', 'signed-out']);
  expect(result.restored).toEqual({id: 'user-4', email: 'reader@example.test'});
  expect(result.signup).toEqual({user: result.restored, signedIn: false, needsConfirmation: true});
  expect(result.signedIn).toEqual(result.restored);
  expect(result.updated).toEqual(result.restored);
  expect(result.calls).toEqual([['signup-redirect', 'http://127.0.0.1:4173/auth/callback/'],
    ['reset', 'reader@example.test', 'http://127.0.0.1:4173/auth/callback/'], 'unsubscribe']);
  expect(JSON.stringify(result)).not.toContain('hidden');
});

test('auth actions before explicit initialization cannot be overwritten by late restoration', async ({page}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    let resolveSignInRestore;
    let resolveSignOutRestore;
    let subscriptions = 0;
    const signInAuth = createGod4Auth({
      initialize: () => new Promise(resolve => { resolveSignInRestore = resolve; }),
      subscribe: () => { subscriptions++; return () => {}; },
      signIn: async () => ({id: 'new-user'})
    });
    await signInAuth.signIn('reader@example.test', 'password');
    resolveSignInRestore(null);
    await signInAuth.initialize();

    const signOutAuth = createGod4Auth({
      initialize: () => new Promise(resolve => { resolveSignOutRestore = resolve; }),
      subscribe: () => { subscriptions++; return () => {}; },
      signOut: async () => {}
    });
    await signOutAuth.signOut();
    resolveSignOutRestore({id: 'old-user'});
    await signOutAuth.initialize();
    return {subscriptions, signedIn: signInAuth.getState(), signedOut: signOutAuth.getState()};
  });
  expect(result).toEqual({
    subscriptions: 2,
    signedIn: {status: 'signed-in', user: {id: 'new-user', email: null}, recovery: false},
    signedOut: {status: 'guest', user: null, recovery: false}
  });
});

test('auth boundary returns controlled errors without provider details', async ({page}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const raw = new Error('private provider response with token');
    raw.access_token = 'hidden';
    const auth = createGod4Auth({
      initialize: async () => null,
      subscribe: () => () => {},
      signUp: async () => { throw raw; },
      signIn: async () => { throw raw; },
      signOut: async () => { throw raw; },
      requestPasswordReset: async () => { throw raw; },
      completePasswordReset: async () => { throw raw; }
    });
    await auth.initialize();
    const actions = [
      () => auth.signUp('reader@example.test', 'password'),
      () => auth.signIn('reader@example.test', 'password'),
      () => auth.signOut(),
      () => auth.requestPasswordReset('reader@example.test'),
      () => auth.completePasswordReset('password')
    ];
    const failures = [];
    for(const action of actions){
      try { await action(); } catch(error){
        failures.push({name: error.name, code: error.code, message: error.message,
          hasToken: Object.hasOwn(error, 'access_token')});
      }
    }
    return failures;
  });
  expect(result.map(error => error.code)).toEqual([
    'sign_up_failed', 'sign_in_failed', 'sign_out_failed',
    'password_reset_request_failed', 'password_reset_failed'
  ]);
  expect(result.every(error => error.name === 'God4AuthError' && !error.hasToken &&
    !error.message.includes('private'))).toBe(true);
});
