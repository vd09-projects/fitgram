import { StatusBar, View, Text } from "react-native";
import styles from "../constants/styles";

export default function LayoutScreen() {
    return (
        <View style={styles.container}>
            <Text>Layout Screen</Text>
            <StatusBar />
        </View>
    )
}