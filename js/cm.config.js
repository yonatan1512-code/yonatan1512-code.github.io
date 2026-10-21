/* CourtMaster AI — public settings for the Supabase project (accounts and sync between devices).
   The publishable key is meant to be in website code; the data is protected by the table's
   row-level security rules (each signed-in user can read and change only their own row).
   Never put a secret key (sb_secret_…) or the database password here. */
(function (CM) {
'use strict';
CM.SUPABASE = {
  url: 'https://czdqmpptguxaneqovbiw.supabase.co',
  key: 'sb_publishable_wQytNgKXx2GMY29zfMVbYA_kz3eRr_D',
  // public half of the notification key pair (the private half is only in the Supabase function's secrets)
  vapid: 'BEI19NNtjwU2bgOzJRMUUK2iqzWz4jlmyHhlgx7Dea_FaDLxJyDAG7jNoW6oHVG1OxUl01vkuSi5Rgluk8BbEi8'
};
})(window.CM = window.CM || {});
