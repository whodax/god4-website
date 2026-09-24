/* Guest-safe application auth boundary. No user data or credentials live here. */
function createGod4Auth(provider){
  var state = {status: 'restoring', user: null, recovery: false};
  var listeners = new Set();
  var initializePromise = null;
  var providerUnsubscribe = null;
  var revision = 0;
  var actionVersion = 0;
  var signOutPending = false;
  var signedOutFence = false;
  var recoveryCompleted = false;

  function getState(){
    return {
      status: state.status,
      user: state.user ? {id: state.user.id, email: state.user.email} : null,
      recovery: state.recovery
    };
  }

  function authFailure(code, message){
    var error = new Error(message);
    error.name = 'God4AuthError';
    error.code = code;
    return error;
  }

  function publish(status, user, recovery){
    var identity = user && typeof user.id === 'string' && user.id ?
      {id: user.id, email: typeof user.email === 'string' ? user.email : null} : null;
    state = {status: status, user: status === 'signed-in' ? identity : null,
      recovery: status === 'signed-in' && Boolean(recovery)};
    listeners.forEach(function(listener){
      try { listener(getState()); } catch(error){ /* A subscriber cannot break auth or Reader startup. */ }
    });
  }

  function subscribe(listener){
    if(typeof listener !== 'function') throw new TypeError('Auth listener must be a function');
    listeners.add(listener);
    try { listener(getState()); } catch(error){ /* Isolate subscriber failures. */ }
    return function(){ listeners.delete(listener); };
  }

  function handleProviderEvent(event){
    if(!event || typeof event.type !== 'string') return;
    if(event.type === 'restored'){
      if(state.status !== 'restoring' || signOutPending || signedOutFence) return;
      revision++;
      publish(event.user ? 'signed-in' : 'guest', event.user, false);
    } else if(event.type === 'signed-in' || event.type === 'recovery'){
      if(signOutPending || signedOutFence || (event.type === 'recovery' && recoveryCompleted)) return;
      revision++;
      publish(event.user ? 'signed-in' : 'unavailable', event.user,
        event.type === 'recovery' || state.recovery);
    } else if(event.type === 'signed-out'){
      revision++;
      if(!signOutPending) actionVersion++;
      signedOutFence = true;
      publish('guest', null, false);
    } else if(event.type === 'user-updated' && state.status === 'signed-in' && event.user){
      revision++;
      publish('signed-in', event.user, state.recovery);
    }
  }

  function initialize(){
    if(initializePromise) return initializePromise;
    if(!provider || typeof provider.initialize !== 'function' || typeof provider.subscribe !== 'function'){
      publish('unavailable', null, false);
      initializePromise = Promise.resolve(getState());
      return initializePromise;
    }
    var startRevision = revision;
    var startAction = actionVersion;
    try { providerUnsubscribe = provider.subscribe(handleProviderEvent); }
    catch(error){
      publish('unavailable', null, false);
      initializePromise = Promise.resolve(getState());
      return initializePromise;
    }
    initializePromise = Promise.resolve().then(function(){ return provider.initialize(); }).then(function(user){
      if(revision === startRevision && actionVersion === startAction){
        revision++;
        publish(user ? 'signed-in' : 'guest', user, false);
      }
      return getState();
    }).catch(function(){
      if(revision === startRevision && actionVersion === startAction){
        revision++;
        publish('unavailable', null, false);
        if(typeof providerUnsubscribe === 'function'){
          try { providerUnsubscribe(); } catch(error){ /* Restoration failure remains guest-safe. */ }
        }
        providerUnsubscribe = null;
      }
      return getState();
    });
    return initializePromise;
  }

  function requireAction(name){
    if(!provider || typeof provider[name] !== 'function')
      return Promise.reject(authFailure('unavailable', 'Authentication unavailable'));
    return null;
  }

  async function signUp(email, password){
    var unavailable = requireAction('signUp');
    if(unavailable) return unavailable;
    initialize();
    var version = ++actionVersion;
    revision++;
    var result;
    try { result = await provider.signUp(email, password); }
    catch(error){
      if(version === actionVersion && state.status === 'restoring') publish('guest', null, false);
      throw authFailure('sign_up_failed', 'Sign up failed');
    }
    if(version === actionVersion){
      if(result && result.signedIn && result.user){
        signedOutFence = false;
        publish('signed-in', result.user, false);
      } else if(state.status === 'restoring') publish('guest', null, false);
    }
    return result;
  }

  async function signIn(email, password){
    var unavailable = requireAction('signIn');
    if(unavailable) return unavailable;
    initialize();
    var version = ++actionVersion;
    revision++;
    var user;
    try { user = await provider.signIn(email, password); }
    catch(error){
      if(version === actionVersion && state.status === 'restoring') publish('guest', null, false);
      throw authFailure('sign_in_failed', 'Sign in failed');
    }
    if(version === actionVersion){
      signedOutFence = false;
      recoveryCompleted = false;
      publish(user ? 'signed-in' : 'unavailable', user, false);
    }
    return user;
  }

  async function signOut(){
    var unavailable = requireAction('signOut');
    if(unavailable) return unavailable;
    initialize();
    var version = ++actionVersion;
    revision++;
    signOutPending = true;
    signedOutFence = true;
    try {
      await provider.signOut();
      if(version === actionVersion) publish('guest', null, false);
    } catch(error){
      if(version === actionVersion) publish('unavailable', null, false);
      throw authFailure('sign_out_failed', 'Sign out failed');
    } finally {
      if(version === actionVersion) signOutPending = false;
    }
  }

  async function requestPasswordReset(email){
    var unavailable = requireAction('requestPasswordReset');
    if(unavailable) return unavailable;
    try { return await provider.requestPasswordReset(email); }
    catch(error){ throw authFailure('password_reset_request_failed', 'Password reset request failed'); }
  }

  async function completePasswordReset(password){
    var unavailable = requireAction('completePasswordReset');
    if(unavailable) return unavailable;
    initialize();
    var version = ++actionVersion;
    revision++;
    var user;
    try { user = await provider.completePasswordReset(password); }
    catch(error){
      if(version === actionVersion && state.status === 'restoring') publish('guest', null, false);
      throw authFailure('password_reset_failed', 'Password reset failed');
    }
    if(version !== actionVersion || signedOutFence || !user)
      throw authFailure('password_reset_failed', 'Password reset failed');
    recoveryCompleted = true;
    publish('signed-in', user, false);
    return user;
  }

  return {initialize: initialize, getState: getState, subscribe: subscribe,
    signUp: signUp, signIn: signIn, signOut: signOut,
    requestPasswordReset: requestPasswordReset, completePasswordReset: completePasswordReset};
}

var God4Auth = createGod4Auth((function(){
  try {
    return typeof SupabaseAuthProvider !== 'undefined' &&
      SupabaseAuthProvider.create(typeof God4AuthConfig === 'undefined' ? null : God4AuthConfig);
  } catch(error){ return null; }
})());

function initializeGod4Auth(){
  Promise.resolve().then(function(){ return God4Auth.initialize(); });
}
if(typeof God4AuthConfig !== 'undefined' && window.location.pathname === God4AuthConfig.callbackPath)
  initializeGod4Auth();
else if(document.readyState === 'loading')
  window.addEventListener('DOMContentLoaded', initializeGod4Auth, {once: true});
else initializeGod4Auth();
