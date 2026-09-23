/* Supabase is confined to this adapter; application state never receives tokens. */
var SupabaseAuthProvider = (function(){
  function userIdentity(value){
    if(!value || typeof value.id !== 'string' || !value.id) return null;
    return {id: value.id, email: typeof value.email === 'string' ? value.email : null};
  }

  function eventForApplication(event, session){
    var user = userIdentity(session && session.user);
    if(event === 'INITIAL_SESSION') return {type: 'restored', user: user};
    if(event === 'SIGNED_IN') return {type: 'signed-in', user: user};
    if(event === 'SIGNED_OUT') return {type: 'signed-out', user: null};
    if(event === 'PASSWORD_RECOVERY') return {type: 'recovery', user: user};
    if(event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') return {type: 'user-updated', user: user};
    return null;
  }

  function create(config, suppliedClient){
    if(!config || config.enabled !== true ||
      typeof config.supabaseUrl !== 'string' || !/^https:\/\//.test(config.supabaseUrl) ||
      typeof config.publishableKey !== 'string' || !config.publishableKey ||
      !Array.isArray(config.allowedHosts) || config.allowedHosts.indexOf(window.location.hostname) < 0) return null;

    var client = suppliedClient;
    if(!client){
      if(!window.supabase || typeof window.supabase.createClient !== 'function') return null;
      try { client = window.supabase.createClient(config.supabaseUrl, config.publishableKey); }
      catch(error){ return null; }
    }
    if(!client || !client.auth) return null;
    var auth = client.auth;

    return {
      initialize: async function(){
        var result = await auth.getSession();
        if(result.error) throw result.error;
        return userIdentity(result.data && result.data.session && result.data.session.user);
      },
      subscribe: function(listener){
        var result = auth.onAuthStateChange(function(event, session){
          var mapped = eventForApplication(event, session);
          if(mapped) listener(mapped);
        });
        var subscription = result && result.data && result.data.subscription;
        return function(){ if(subscription && typeof subscription.unsubscribe === 'function') subscription.unsubscribe(); };
      },
      signUp: async function(email, password){
        var result = await auth.signUp({email: email, password: password});
        if(result.error) throw result.error;
        return {
          user: userIdentity(result.data && result.data.user),
          signedIn: Boolean(result.data && result.data.session),
          needsConfirmation: !result.data || !result.data.session
        };
      },
      signIn: async function(email, password){
        var result = await auth.signInWithPassword({email: email, password: password});
        if(result.error) throw result.error;
        return userIdentity(result.data && result.data.user);
      },
      signOut: async function(){
        var result = await auth.signOut();
        if(result.error) throw result.error;
      },
      requestPasswordReset: async function(email){
        var result = await auth.resetPasswordForEmail(email);
        if(result.error) throw result.error;
      },
      completePasswordReset: async function(password){
        var result = await auth.updateUser({password: password});
        if(result.error) throw result.error;
        return userIdentity(result.data && result.data.user);
      }
    };
  }

  return {create: create};
})();
