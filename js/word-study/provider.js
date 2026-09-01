/* ===== SCRIPTURE WORD STUDY PROVIDER CONTRACT ===== */
var WordStudyProvider = (function createWordStudyProvider(){
  function normalizeLookupTerm(value){
    return String(value || '').toLowerCase().replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
  }

  return {
    normalizeLookupTerm: normalizeLookupTerm
  };
}());