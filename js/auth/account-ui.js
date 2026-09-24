/* Account UI depends only on the GOD4.us auth service. Local user data stays local. */
(function(){
  function initializeAccountUI(){
    var trigger = document.getElementById('accountTrigger');
    var dialog = document.getElementById('accountDialog');
    if(!trigger || !dialog || typeof God4Auth === 'undefined') return;

    var closeButton = document.getElementById('accountClose');
    var title = document.getElementById('accountTitle');
    var signInForm = document.getElementById('accountSignInForm');
    var signUpForm = document.getElementById('accountSignUpForm');
    var resetForm = document.getElementById('accountResetForm');
    var resetSentPanel = document.getElementById('accountResetSent');
    var resetSentTitle = document.getElementById('accountResetSentTitle');
    var signedInPanel = document.getElementById('accountSignedIn');
    var identity = document.getElementById('accountIdentity');
    var unavailablePanel = document.getElementById('accountUnavailable');
    var restoringPanel = document.getElementById('accountRestoring');
    var confirmationPanel = document.getElementById('accountConfirmation');
    var confirmationTitle = document.getElementById('accountConfirmationTitle');
    var errorText = document.getElementById('accountError');
    var signOutButton = document.getElementById('accountSignOut');
    var mode = 'sign-in';
    var busy = false;
    var resetRequestVersion = 0;
    var state = God4Auth.getState();
    function passwordVisibility(form, toggleId){
      var toggle = document.getElementById(toggleId);
      var fields = Array.from(form.querySelectorAll('input[type="password"]'));
      function update(){
        fields.forEach(function(field){ field.type = toggle.checked ? 'text' : 'password'; });
      }
      toggle.addEventListener('change', update);
      return function(){ toggle.checked = false; update(); };
    }

    var hideSignInPassword = passwordVisibility(signInForm, 'accountSignInShowPassword');
    var hideSignUpPassword = passwordVisibility(signUpForm, 'accountSignUpShowPassword');
    function hidePasswords(){ hideSignInPassword(); hideSignUpPassword(); }

    function clearError(){
      errorText.textContent = '';
      errorText.hidden = true;
      dialog.querySelectorAll('[aria-invalid="true"]').forEach(function(field){
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
      });
    }

    function showError(message, field){
      clearError();
      errorText.textContent = message;
      errorText.hidden = false;
      if(field){
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', 'accountError');
        field.focus();
      } else {
        errorText.setAttribute('tabindex', '-1');
        errorText.focus();
      }
    }

    function setBusy(value){
      busy = value;
      dialog.querySelectorAll('.account-submit, .account-switch').forEach(function(button){
        button.disabled = value;
      });
    }

    function activePanel(){
      if(state.status === 'unavailable') return unavailablePanel;
      if(state.status === 'restoring') return restoringPanel;
      if(state.status === 'signed-in') return signedInPanel;
      if(mode === 'confirmation') return confirmationPanel;
      if(mode === 'reset') return resetForm;
      if(mode === 'reset-sent') return resetSentPanel;
      return mode === 'sign-up' ? signUpForm : signInForm;
    }

    function focusPanel(){
      var panel = activePanel();
      if(panel === signInForm) signInForm.elements.email.focus();
      else if(panel === signUpForm) signUpForm.elements.email.focus();
      else if(panel === confirmationPanel) confirmationTitle.focus();
      else if(panel === resetForm) resetForm.elements.email.focus();
      else if(panel === resetSentPanel) resetSentTitle.focus();
      else if(panel === signedInPanel) signOutButton.focus();
      else closeButton.focus();
    }

    function render(){
      identity.textContent = state.user ? (state.user.email || state.user.id) : '';
      trigger.textContent = state.status === 'signed-in' && state.user ?
        (state.user.email || 'Account') : 'Account';
      trigger.setAttribute('aria-label', state.status === 'signed-in' && state.user ?
        'Account: ' + (state.user.email || state.user.id) : 'Account');
      var panel = activePanel();
      [signInForm, signUpForm, resetForm, resetSentPanel, signedInPanel, unavailablePanel, restoringPanel, confirmationPanel].forEach(function(item){
        item.hidden = item !== panel;
      });
      title.textContent = panel === signInForm ? 'Sign In' :
        panel === signUpForm ? 'Create Account' :
        panel === resetForm || panel === resetSentPanel ? 'Reset Password' : 'Account';
      if(dialog.open && !dialog.contains(document.activeElement)) focusPanel();
    }

    function openDialog(){
      if(dialog.open) return;
      clearError();
      hidePasswords();
      dialog.showModal();
      trigger.setAttribute('aria-expanded', 'true');
      render();
      focusPanel();
    }

    function closeDialog(){
      if(dialog.open) dialog.close();
    }

    function setMode(nextMode){
      if(busy) return;
      mode = nextMode;
      hidePasswords();
      clearError();
      render();
      if(dialog.open) focusPanel();
    }

    function validate(form){
      var email = form.elements.email;
      var password = form.elements.password;
      if(!email.value.trim() || !email.checkValidity()){
        showError('Enter a valid email address.', email);
        return false;
      }
      if(!password.value){
        showError('Enter a password.', password);
        return false;
      }
      return true;
    }

    function authMessage(action, error){
      if(error && error.code === 'unavailable')
        return 'Accounts are unavailable right now. You can keep using GOD4.us.';
      if(action === 'sign-in')
        return 'Sign in failed. Check your email, password, or connection and try again.';
      if(action === 'sign-up')
        return 'Could not create the account. Check your details or connection, or try signing in.';
      return 'Could not sign out. Please check your connection and try again.';
    }

    function focusableControls(){
      return Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(function(element){ return element.getClientRects().length > 0; });
    }

    trigger.addEventListener('click', openDialog);
    closeButton.addEventListener('click', closeDialog);
    dialog.addEventListener('close', function(){
      hidePasswords();
      trigger.setAttribute('aria-expanded', 'false');
      clearError();
      if(mode === 'reset' || mode === 'reset-sent'){
        resetRequestVersion++;
        setBusy(false);
        resetForm.reset();
        mode = 'sign-in';
      }
      trigger.focus();
    });
    dialog.addEventListener('cancel', function(event){
      event.preventDefault();
      closeDialog();
    });
    dialog.addEventListener('keydown', function(event){
      if(event.key !== 'Tab') return;
      var controls = focusableControls();
      if(!controls.length) return;
      var first = controls[0];
      var last = controls[controls.length - 1];
      if(event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))){
        event.preventDefault();
        last.focus();
      } else if(!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))){
        event.preventDefault();
        first.focus();
      }
    });
    document.getElementById('accountShowSignUp').addEventListener('click', function(){ setMode('sign-up'); });
    document.getElementById('accountShowReset').addEventListener('click', function(){ setMode('reset'); });
    document.getElementById('accountResetBack').addEventListener('click', function(){ setMode('sign-in'); });
    document.getElementById('accountResetSentSignIn').addEventListener('click', function(){ setMode('sign-in'); });
    document.getElementById('accountShowSignIn').addEventListener('click', function(){ setMode('sign-in'); });
    document.getElementById('accountConfirmationSignIn').addEventListener('click', function(){ setMode('sign-in'); });

    resetForm.addEventListener('submit', async function(event){
      event.preventDefault();
      if(busy) return;
      var email = resetForm.elements.email;
      if(!email.value.trim() || !email.checkValidity()){
        showError('Enter a valid email address.', email);
        return;
      }
      clearError();
      setBusy(true);
      var requestVersion = ++resetRequestVersion;
      try {
        await God4Auth.requestPasswordReset(email.value.trim());
        if(requestVersion !== resetRequestVersion) return;
        mode = 'reset-sent';
        render();
        resetSentTitle.focus();
      } catch(error){
        if(requestVersion === resetRequestVersion)
          showError('Could not send a reset link. Check your connection and try again.');
      } finally {
        if(requestVersion === resetRequestVersion) setBusy(false);
      }
    });

    signInForm.addEventListener('submit', async function(event){
      event.preventDefault();
      if(busy || !validate(signInForm)) return;
      clearError();
      setBusy(true);
      try {
        await God4Auth.signIn(signInForm.elements.email.value.trim(), signInForm.elements.password.value);
        if(God4Auth.getState().status === 'signed-in') closeDialog();
        else showError('Sign in is unavailable right now. Please try again.');
      } catch(error){
        showError(authMessage('sign-in', error));
      } finally {
        signInForm.elements.password.value = '';
        setBusy(false);
      }
    });

    signUpForm.addEventListener('submit', async function(event){
      event.preventDefault();
      if(busy || !validate(signUpForm)) return;
      clearError();
      setBusy(true);
      try {
        var result = await God4Auth.signUp(signUpForm.elements.email.value.trim(), signUpForm.elements.password.value);
        if(God4Auth.getState().status === 'signed-in'){
          closeDialog();
        } else if(result && result.needsConfirmation){
          mode = 'confirmation';
          render();
          confirmationTitle.focus();
        } else {
          showError('Could not create the account. Please try again.');
        }
      } catch(error){
        showError(authMessage('sign-up', error));
      } finally {
        signUpForm.elements.password.value = '';
        setBusy(false);
      }
    });

    signOutButton.addEventListener('click', async function(){
      if(busy) return;
      clearError();
      setBusy(true);
      try {
        await God4Auth.signOut();
        closeDialog();
      } catch(error){
        showError(authMessage('sign-out', error));
      } finally {
        setBusy(false);
      }
    });

    God4Auth.subscribe(function(nextState){
      state = nextState;
      render();
    });
  }

  if(document.readyState === 'loading')
    window.addEventListener('DOMContentLoaded', initializeAccountUI, {once: true});
  else initializeAccountUI();
})();
