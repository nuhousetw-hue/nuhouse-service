/**
 * 新濠建設客服平台 – 前端設定
 *
 * 部署 Google Apps Script 後，將網址填入 GAS_URL。
 * 範例：https://script.google.com/macros/s/AKfy.../exec
 */
const CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbwn0SZsVlkRszaylUp6_ZTKa0upE22N8RDcgGrEubJMDm0AfSeflemA1QOdnGoZ5kYu/exec",

  // 上傳單檔大小上限（bytes），預設 20 MB
  MAX_FILE_SIZE: 20 * 1024 * 1024,

  // Session 存在 sessionStorage 的 key
  SESSION_KEY: "xh_session",
};
