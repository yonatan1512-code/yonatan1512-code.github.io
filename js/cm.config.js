/* CourtMaster AI — public settings for the Supabase project (accounts and sync between devices).
   The publishable key is meant to be in website code; the data is protected by the table's
   row-level security rules (each signed-in user can read and change only their own row).
   Never put a secret key (sb_secret_…) or the database password here. */
(function (CM) {
'use strict';
CM.SUPABASE = {
  url: 'https://czdqmpptguxaneqovbiw.supabase.co',
  key: 'sb_publishable_wQytNgKXx2GMY29zfMVbYA_kz3eRr_D'
};
})(window.CM = window.CM || {});
