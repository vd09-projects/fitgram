import { BaseToast, BaseToastProps, ErrorToast } from "react-native-toast-message";

export const toastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#4CAF50', // Success Green
        backgroundColor: '#B2B5E0',
        borderRadius: 8,
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2E7D32', // Darker Green
      }}
      text2Style={{
        fontSize: 14,
        color: '#1B5E20', // Slightly darker green
      }}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: '#D32F2F', // Error Red
        backgroundColor: "#B2B5E0", // Light Red Background
        borderRadius: 8,
        paddingVertical: 10,
        minHeight: undefined,
        height: 'auto',
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        fontSize: 16,
        fontWeight: 'bold',
        color: '#C62828', // Darker Red
      }}
      text2Style={{
        fontSize: 14,
        color: '#B71C1C', // Slightly darker red
      }}
      text2NumberOfLines={0}
    />
  ),
  warning: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#FFA000', // Warning Orange
        backgroundColor: "#B2B5E0",
        borderRadius: 8,
        paddingVertical: 10,
        minHeight: undefined,
        height: 'auto',
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        fontSize: 16,
        fontWeight: 'bold',
        color: '#E65100', // Darker Orange
      }}
      text2Style={{
        fontSize: 14,
        color: '#BF360C', // Slightly darker orange
      }}
      text2NumberOfLines={0}
    />
  ),
};