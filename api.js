// Gọi API Apps Script. Dùng text/plain để tránh preflight CORS.
async function apiCall(action, params) {
  params = params || {};
  const body = Object.assign({ action }, params);
  const token = localStorage.getItem('token');
  if (token) body.token = token;

  let res;
  try {
    res = await fetch(window.APP_CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });
  } catch (e) {
    throw new Error('Không kết nối được máy chủ. Kiểm tra URL API và mạng.');
  }
  let json;
  try { json = await res.json(); }
  catch (e) { throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Kiểm tra lại URL web app.'); }

  if (!json.ok) {
    if (/Phiên đã hết hạn/.test(json.error || '')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    throw new Error(json.error || 'Lỗi không rõ');
  }
  return json.data;
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); }
  catch (e) { return null; }
}
function setSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
