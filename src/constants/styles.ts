import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#C5ADC5',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: '#5A3E62',
    },
    input: {
      width: '80%',
      padding: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: '#B2B5E0',
      borderRadius: 8,
      backgroundColor: '#fff',
    },
    link: {
      color: '#0000FF',
      marginTop: 10,
    },
    button: {
      backgroundColor: '#A084CF', // Soft Lavender
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3, // For Android shadow
    },
    buttonText: {
      color: '#FFFFFF', // White text for contrast
      fontSize: 18,
      fontWeight: 'bold',
    },
    switchText: {
        marginVertical: 12,
        color: '#5A3E62',
        textAlign: 'center',
        textDecorationLine: 'underline',
        fontStyle: 'italic',
      },
  });

export default styles;