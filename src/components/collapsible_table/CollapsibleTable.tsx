import React, { useState } from 'react';
import {
  View,
  ScrollView,
  LayoutChangeEvent,
  Platform,
  UIManager,
  LayoutAnimation,
  TouchableOpacity,
} from 'react-native';
import { TableHeader, TableRow, CollapsibleContent, Column } from './CollapsibleTableParts';
import { CollapsibleTableStyles, defaultStyles } from './CollapsibleTableStyles';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export type CollapsibleTableProps<T extends Record<string, any>> = {
  data: T[];
  columns: Column<T>[];
  visibleColumns: Column<T>[];
  renderCollapse?: (item: T) => React.ReactNode;
  customStyles?: Partial<CollapsibleTableStyles>;
};

export function CollapsibleTable<T extends Record<string, any>>({
  data,
  columns,
  visibleColumns,
  renderCollapse,
  customStyles = {},
}: CollapsibleTableProps<T>) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());
  const [colWidths, setColWidths] = useState<{ [key: string]: number }>({});

  const styles = { ...defaultStyles, ...customStyles };

  const hiddenColumns = columns.filter(
    (col) => !visibleColumns.some((vc) => vc.key === col.key)
  );

  const updateWidth = (key: string, width: number) => {
    setColWidths((prev) => {
      const prevWidth = prev[key] || 0;
      return width > prevWidth ? { ...prev, [key]: width } : prev;
    });
  };

  const onTextLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    updateWidth(key, width + 16);
  };

  const toggleCollapse = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndices((prev) => {
      const newSet = new Set(prev);
      newSet.has(index) ? newSet.delete(index) : newSet.add(index);
      return newSet;
    });
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.outerScroll}>
      <View style={styles.container}>
        <TableHeader
          visibleColumns={visibleColumns}
          colWidths={colWidths}
          onTextLayout={onTextLayout}
          styles={styles}
        />

        {data.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.rowContainer, index % 2 === 0 ? styles.evenRowColor : styles.oddRowColor]}
            activeOpacity={0.7}>
            <TableRow
              item={item}
              index={index}
              isOpen={openIndices.has(index)}
              toggle={toggleCollapse}
              visibleColumns={visibleColumns}
              colWidths={colWidths}
              styles={styles}
            />
            {openIndices.has(index) && (
              <CollapsibleContent
                item={item}
                hiddenColumns={hiddenColumns}
                renderCollapse={renderCollapse}
                styles={styles}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}