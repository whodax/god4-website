/* Public browser configuration for the one approved staging preview only. */
var God4AuthConfig = Object.freeze({
  enabled: true,
  supabaseUrl: 'https://ikzvyuvrvxemliirlfmn.supabase.co',
  publishableKey: 'sb_publishable_sfb2p-E6DmnOvyBsC_cRHA_d9JPeC8Y',
  allowedHosts: ['feature-optional-user-accoun.god4-us.pages.dev'],
  allowedOrigins: ['https://feature-optional-user-accoun.god4-us.pages.dev', 'http://127.0.0.1:4173'],
  callbackPath: '/auth/callback/'
});

/* Redirects come only from explicit origins, never from callback query parameters. */
var God4AuthUrls = Object.freeze({
  callbackUrl: function(config){
    if(!config || !Array.isArray(config.allowedOrigins) ||
      config.allowedOrigins.indexOf(window.location.origin) < 0 ||
      config.callbackPath !== '/auth/callback/') return null;
    return window.location.origin + config.callbackPath;
  },
  returnUrl: function(config){
    if(config && Array.isArray(config.allowedOrigins) &&
      config.allowedOrigins.indexOf(window.location.origin) >= 0)
      return window.location.origin + '/';
    return 'https://god4.us/';
  }
});
