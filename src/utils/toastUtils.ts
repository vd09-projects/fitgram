import Toast from 'react-native-toast-message';

type ToastType = 'error' | 'success' | 'info' | 'warning';

const getDefaultTitle = (type: ToastType): string => {
  switch (type) {
    case 'error': return 'Error';
    case 'success': return 'Success';
    case 'info': return 'Info';
    case 'warning': return 'Warning';
    default: return 'Notification';
  }
};

const showToast = (type: ToastType, titleOrMessage: string, message?: string): void => {
  Toast.show({
    type,
    text1: message ? titleOrMessage : getDefaultTitle(type),
    text2: message || titleOrMessage,
    position: 'top',
    visibilityTime: 3000,
    autoHide: true,
  });
};

const show = {
  alert: (titleOrMessage: string, message?: string) => showToast('error', titleOrMessage, message),
  success: (titleOrMessage: string, message?: string) => showToast('success', titleOrMessage, message),
  info: (titleOrMessage: string, message?: string) => showToast('info', titleOrMessage, message),
  warn: (titleOrMessage: string, message?: string) => showToast('warning', titleOrMessage, message),
};

export default show;