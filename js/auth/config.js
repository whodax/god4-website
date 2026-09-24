/* Public browser configuration selected only for the approved exact origins. */
var God4AuthConfig = (function(){
  var production = Object.freeze({
    enabled: true,
    supabaseUrl: 'https://apkiqgxmfqohznxpqfcx.supabase.co',
    publishableKey: 'sb_publishable_semQOcN32nqeu-Y1jjFObg_N7lEOMvL',
    allowedHosts: ['god4.us'],
    allowedOrigins: ['https://god4.us'],
    callbackPath: '/auth/callback/'
  });
  var staging = Object.freeze({
    enabled: true,
    supabaseUrl: 'https://ikzvyuvrvxemliirlfmn.supabase.co',
    publishableKey: 'sb_publishable_sfb2p-E6DmnOvyBsC_cRHA_d9JPeC8Y',
    allowedHosts: ['feature-optional-user-accoun.god4-us.pages.dev',
      'feature-account-show-password.god4-us.pages.dev'],
    allowedOrigins: ['https://feature-optional-user-accoun.god4-us.pages.dev',
      'https://feature-account-show-password.god4-us.pages.dev'],
    callbackPath: '/auth/callback/'
  });
  var unavailable = Object.freeze({
    enabled: false,
    allowedHosts: [],
    allowedOrigins: [],
    callbackPath: '/auth/callback/'
  });

  if(window.location.origin === 'https://god4.us') return production;
  if(window.location.origin === 'https://feature-optional-user-accoun.god4-us.pages.dev') return staging;
  if(window.location.origin === 'https://feature-account-show-password.god4-us.pages.dev') return staging;
  return unavailable;
})();

/* Redirects come only from explicit origins, never from callback query parameters. */
var God4AuthUrls = Object.freeze({
  callbackUrl: function(config){
    if(!config || config.enabled !== true || !Array.isArray(config.allowedOrigins) ||
      config.allowedOrigins.indexOf(window.location.origin) < 0 ||
      config.callbackPath !== '/auth/callback/') return null;
    return window.location.origin + config.callbackPath;
  },
  returnUrl: function(config){
    if(config && config.enabled === true && Array.isArray(config.allowedOrigins) &&
      config.allowedOrigins.indexOf(window.location.origin) >= 0)
      return window.location.origin + '/';
    /* The local test callback remains on the local site without enabling local auth. */
    if(window.location.origin === 'http://127.0.0.1:4173') return window.location.origin + '/';
    return 'https://god4.us/';
  }
});
