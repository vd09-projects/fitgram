import React from "react";
import {
  View,
  Text,
} from "react-native";
import { SPACING } from "../../constants/styles";
import { CollapsibleTable } from "./CollapsibleTable";
import { Column } from "./CollapsibleTableParts";

type Dessert = {
  name: string;
  calories: number;
  fat: number;
  fat1: number;
  fat2: number;
  fat3: number;
  history: {
    date: string;
    customer: string;
    amount: number;
  }[];
};

const dessertData: Dessert[] = [
  {
    name: 'Frozen yoghurt',
    calories: 159,
    fat: 6.0,
    fat1: 6.0,
    fat2: 6.0,
    fat3: 6.0,
    history: [
      { date: '2020-01-05', customer: 'User1', amount: 3 },
      { date: '2020-01-02', customer: 'Anonymous', amount: 1 },
    ],
  },
  {
    name: 'Ice cream sandwich',
    calories: 237,
    fat: 9.0,
    fat1: 6.0,
    fat2: 6.0,
    fat3: 6.0,
    history: [
      { date: '2020-02-10', customer: 'User2', amount: 2 },
    ],
  },
];

const columns: Column<Dessert>[] = [
  { key: 'name' as keyof Dessert, label: 'Dessert Sweet Yum' },
  { key: 'calories' as keyof Dessert, label: 'Calories', align: 'right' },
  { key: 'fat' as keyof Dessert, label: 'Fat (g)', align: 'right' },
  { key: 'fat1' as keyof Dessert, label: 'Fat1 (g)', align: 'right' },
  { key: 'fat2' as keyof Dessert, label: 'Fat2 (g)', align: 'right' },
  { key: 'fat3' as keyof Dessert, label: 'Fat3 (g)', align: 'right' },
];

export default function TestingCollapsibleTable() {

  const renderInvertedTable1 = () => (
      <CollapsibleTable<Dessert>
        data={dessertData}
        columns={columns}
        visibleColumns={columns.slice(0, 4)}
        renderCollapse={(item) => {
          if (item.history.length < 2) return undefined
          return <View>
            {item.history.map((entry, index) => (
              <View key={index} style={{ paddingVertical: 4 }}>
                <Text>{`📅 ${entry.date}`}</Text>
                <Text>{`🧑‍💼 ${entry.customer}`}</Text>
                <Text>{`📦 Amount: ${entry.amount}`}</Text>
              </View>
            ))}
          </View>
        }}
      />
  );

  return (
    <View style={{ flex: 1, padding: SPACING.small }}>
{renderInvertedTable1()}
    </View>
  );
}
