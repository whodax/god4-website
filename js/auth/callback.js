/* Dedicated auth callback controller. The provider owns URL session tokens. */
(function(){
  var query = new URLSearchParams(window.location.search);
  var fragment = new URLSearchParams(window.location.hash.slice(1));
  var callbackType = query.get('type') || fragment.get('type') || '';
  var hasCredential = query.has('code') || query.has('token_hash') ||
    fragment.has('access_token') || fragment.has('refresh_token');
  var hasCallbackError = query.has('error') || query.has('error_code') ||
    fragment.has('error') || fragment.has('error_code');
  var knownType = !callbackType || ['recovery', 'signup', 'email', 'confirmation', 'magiclink'].indexOf(callbackType) >= 0;

  function initializeCallback(){
    var status = document.getElementById('callbackStatus');
    var errorPanel = document.getElementById('callbackError');
    var errorTitle = document.getElementById('callbackErrorTitle');
    var confirmedPanel = document.getElementById('callbackConfirmed');
    var confirmedTitle = document.getElementById('callbackConfirmedTitle');
    var resetForm = document.getElementById('callbackResetForm');
    var resetTitle = document.getElementById('callbackResetTitle');
    var successPanel = document.getElementById('callbackResetSuccess');
    var successTitle = document.getElementById('callbackResetSuccessTitle');
    var formError = document.getElementById('callbackFormError');
    var continueLink = document.getElementById('callbackContinue');
    var showPassword = document.getElementById('callbackShowPassword');
    var passwordFields = [resetForm.elements.password, resetForm.elements.confirmation];
    showPassword.addEventListener('change', function(){
      passwordFields.forEach(function(field){ field.type = showPassword.checked ? 'text' : 'password'; });
    });
    var view = 'checking';
    var ready = false;
    var busy = false;
    var completed = false;
    var authState = God4Auth.getState();

    continueLink.href = typeof God4AuthUrls !== 'undefined' ?
      God4AuthUrls.returnUrl(typeof God4AuthConfig === 'undefined' ? null : God4AuthConfig) :
      'https://god4.us/';

    function showView(next){
      if(view === next) return;
      view = next;
      status.hidden = next !== 'checking';
      errorPanel.hidden = next !== 'error';
      confirmedPanel.hidden = next !== 'confirmed';
      resetForm.hidden = next !== 'reset';
      successPanel.hidden = next !== 'success';
      if(next === 'error') errorTitle.focus();
      else if(next === 'confirmed') confirmedTitle.focus();
      else if(next === 'reset') resetTitle.focus();
      else if(next === 'success') successTitle.focus();
    }

    function render(){
      if(!ready || busy) return;
      if(completed){ showView('success'); return; }
      if(hasCallbackError || !knownType){ showView('error'); return; }
      if(authState.status === 'signed-in' && authState.recovery){
        showView('reset');
      } else if(callbackType === 'recovery'){
        showView('error');
      } else if(hasCredential && authState.status === 'signed-in'){
        showView('confirmed');
      } else {
        showView('error');
      }
    }

    function clearFormError(){
      formError.hidden = true;
      formError.textContent = '';
      resetForm.querySelectorAll('[aria-invalid="true"]').forEach(function(field){
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
      });
    }

    function showFormError(message, field){
      clearFormError();
      formError.textContent = message;
      formError.hidden = false;
      if(field){
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', 'callbackFormError');
        field.focus();
      } else {
        formError.setAttribute('tabindex', '-1');
        formError.focus();
      }
    }

    resetForm.addEventListener('submit', async function(event){
      event.preventDefault();
      if(busy || !ready || !God4Auth.getState().recovery) return;
      var password = resetForm.elements.password;
      var confirmation = resetForm.elements.confirmation;
      if(!password.value){
        showFormError('Enter a new password.', password);
        return;
      }
      if(!confirmation.value || confirmation.value !== password.value){
        showFormError('Passwords must match.', confirmation);
        return;
      }
      clearFormError();
      busy = true;
      resetForm.querySelector('button[type="submit"]').disabled = true;
      try {
        await God4Auth.completePasswordReset(password.value);
        if(God4Auth.getState().status !== 'signed-in') return;
        completed = true;
        showView('success');
      } catch(error){
        if(God4Auth.getState().status === 'signed-in' && God4Auth.getState().recovery)
          showFormError('Could not update your password. The link may have expired; request a new one and try again.');
      } finally {
        password.value = '';
        confirmation.value = '';
        busy = false;
        resetForm.querySelector('button[type="submit"]').disabled = false;
        if(!completed) render();
      }
    });

    God4Auth.subscribe(function(nextState){
      authState = nextState;
      render();
    });

    Promise.resolve().then(function(){ return God4Auth.initialize(); }).catch(function(){
      /* Auth service normally contains provider failures, but the callback still resolves safely. */
    }).then(function(){
      ready = true;
      try { window.history.replaceState(null, '', window.location.pathname); }
      catch(error){ /* A failed URL cleanup must not expose callback values in the page. */ }
      render();
    });
  }

  if(document.readyState === 'loading')
    window.addEventListener('DOMContentLoaded', initializeCallback, {once: true});
  else initializeCallback();
})();
