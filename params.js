// Default tracking parameter definitions.
// mode: "remove" | "replace" | "random"
// value: used only when mode === "replace"
const DEFAULT_PARAMS = [
  // UTM (Google Analytics / generic)
  { name: "utm_source",          mode: "remove", value: "" },
  { name: "utm_medium",          mode: "remove", value: "" },
  { name: "utm_campaign",        mode: "remove", value: "" },
  { name: "utm_term",            mode: "remove", value: "" },
  { name: "utm_content",         mode: "remove", value: "" },
  { name: "utm_id",              mode: "remove", value: "" },
  { name: "utm_source_platform", mode: "remove", value: "" },
  { name: "utm_creative_format", mode: "remove", value: "" },
  { name: "utm_marketing_tactic",mode: "remove", value: "" },
  // Google Ads
  { name: "gclid",   mode: "remove", value: "" },
  { name: "gclsrc",  mode: "remove", value: "" },
  { name: "wbraid",  mode: "remove", value: "" },
  { name: "gbraid",  mode: "remove", value: "" },
  // Facebook / Meta
  { name: "fbclid",  mode: "remove", value: "" },
  // Microsoft / Bing
  { name: "msclkid", mode: "remove", value: "" },
  // Twitter / X
  { name: "twclid",  mode: "remove", value: "" },
  // TikTok
  { name: "ttclid",  mode: "remove", value: "" },
  // Pinterest
  { name: "epik",    mode: "remove", value: "" },
  // Instagram
  { name: "igshid",  mode: "remove", value: "" },
  // Yandex
  { name: "yclid",     mode: "remove", value: "" },
  { name: "_openstat", mode: "remove", value: "" },
  // Mailchimp
  { name: "mc_cid",  mode: "remove", value: "" },  // campaign ID
  { name: "mc_eid",  mode: "remove", value: "" },  // recipient e-mail ID
  // HubSpot
  { name: "_hsenc",  mode: "remove", value: "" },
  { name: "_hsmi",   mode: "remove", value: "" },
  { name: "hsa_acc", mode: "remove", value: "" },
  { name: "hsa_cam", mode: "remove", value: "" },
  { name: "hsa_grp", mode: "remove", value: "" },
  { name: "hsa_ad",  mode: "remove", value: "" },
  { name: "hsa_src", mode: "remove", value: "" },
  { name: "hsa_tgt", mode: "remove", value: "" },
  { name: "hsa_kw",  mode: "remove", value: "" },
  { name: "hsa_mt",  mode: "remove", value: "" },
  { name: "hsa_net", mode: "remove", value: "" },
  { name: "hsa_ver", mode: "remove", value: "" },
];
