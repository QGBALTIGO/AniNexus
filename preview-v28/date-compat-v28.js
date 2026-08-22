'use strict';
(() => {
  const Native=Intl.DateTimeFormat;
  function SafeDateTimeFormat(locales,options){
    return new Native(locales==='yyyy-MM-dd'?'en-CA':locales,options);
  }
  SafeDateTimeFormat.prototype=Native.prototype;
  SafeDateTimeFormat.supportedLocalesOf=Native.supportedLocalesOf.bind(Native);
  Intl.DateTimeFormat=SafeDateTimeFormat;
})();
