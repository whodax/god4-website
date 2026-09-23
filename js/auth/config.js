/* Public browser configuration only. Auth remains disabled until explicitly configured. */
var God4AuthConfig = Object.freeze({
  enabled: false,
  supabaseUrl: '',
  publishableKey: '',
  allowedHosts: [],
  allowedOrigins: ['https://god4.us', 'http://127.0.0.1:4173'],
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
