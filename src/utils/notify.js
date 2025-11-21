import { toast } from 'react-toastify';

export function notifyError(tOrMessage, maybeKey, params) {
  try {
    let msg;
    if (typeof tOrMessage === 'function') {
      msg = tOrMessage(maybeKey, params);
    } else {
      msg = String(tOrMessage ?? '');
    }
    toast.error(msg, { autoClose: 2500, hideProgressBar: true });
  } catch (_) {
    toast.error(String(maybeKey || tOrMessage || 'Error'), { autoClose: 2500, hideProgressBar: true });
  }
}

export function notifySuccess(tOrMessage, maybeKey, params) {
  try {
    let msg;
    if (typeof tOrMessage === 'function') {
      msg = tOrMessage(maybeKey, params);
    } else {
      msg = String(tOrMessage ?? '');
    }
    toast.success(msg, { autoClose: 2000, hideProgressBar: true });
  } catch (_) {
    toast.success(String(maybeKey || tOrMessage || 'OK'), { autoClose: 2000, hideProgressBar: true });
  }
}

export function notifyInfo(tOrMessage, maybeKey, params) {
  try {
    let msg;
    if (typeof tOrMessage === 'function') {
      msg = tOrMessage(maybeKey, params);
    } else {
      msg = String(tOrMessage ?? '');
    }
    toast.info(msg, { autoClose: 2500, hideProgressBar: true });
  } catch (_) {
    toast.info(String(maybeKey || tOrMessage || 'Info'), { autoClose: 2500, hideProgressBar: true });
  }
}

export function notifyWarn(tOrMessage, maybeKey, params) {
  try {
    let msg;
    if (typeof tOrMessage === 'function') {
      msg = tOrMessage(maybeKey, params);
    } else {
      msg = String(tOrMessage ?? '');
    }
    toast.warn(msg, { autoClose: 2500, hideProgressBar: true });
  } catch (_) {
    toast.warn(String(maybeKey || tOrMessage || 'Warning'), { autoClose: 2500, hideProgressBar: true });
  }
}