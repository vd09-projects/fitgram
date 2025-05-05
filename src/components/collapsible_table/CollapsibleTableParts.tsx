import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { CollapsibleTableStyles } from './CollapsibleTableStyles';
import { TextBase } from '../TextBase';

export type Column<T> = {
  key: keyof T;
  label: string;
  align?: 'left' | 'center' | 'right';
};

function getAlignment(align?: string) {
  switch (align) {
    case 'center':
      return 'center';
    case 'right':
      return 'flex-end';
    default:
      return 'flex-start';
  }
}

export function TableHeader<T>({
  visibleColumns,
  colWidths,
  onTextLayout,
  styles,
}: {
  visibleColumns: Column<T>[];
  colWidths: Record<string, number>;
  onTextLayout: (key: string) => (e: LayoutChangeEvent) => void;
  styles: CollapsibleTableStyles;
}) {
  return (
    <View style={[styles.row, styles.header]}>
      <View style={styles.iconCell} />
      {visibleColumns.map((col) => (
        <View
          key={String(col.key)}
          style={[
            styles.cell,
            { width: colWidths[String(col.key)] ?? undefined },
            { alignItems: getAlignment(col.align) },
          ]}
        >
          <TextBase style={styles.headerText} onLayout={onTextLayout(String(col.key))}>
            {col.label}
          </TextBase>
        </View>
      ))}
    </View>
  );
}

export function TableRow<T>({
  item,
  index,
  isOpen,
  toggle,
  visibleColumns,
  colWidths,
  styles,
}: {
  item: T;
  index: number;
  isOpen: boolean;
  toggle: (index: number) => void;
  visibleColumns: Column<T>[];
  colWidths: Record<string, number>;
  styles: CollapsibleTableStyles;
}) {
  return (
    <TouchableOpacity onPress={() => toggle(index)}>
      <View style={[styles.row]}>
        <View style={styles.iconCell}>
          <AntDesign name={isOpen ? 'right' : 'down'} size={16} />
        </View>
        {visibleColumns.map((col) => (
          <View
            key={String(col.key)}
            style={[
              styles.cell,
              { width: colWidths[String(col.key)] ?? undefined },
              { alignItems: getAlignment(col.align) },
            ]}
          >
            <TextBase numberOfLines={2} ellipsizeMode="tail" style={styles.rowText}>
            {/* <TextBase numberOfLines={1} ellipsizeMode="tail"> */}
              {String(item[col.key])}
            </TextBase>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

export function CollapsibleContent<T>({
  item,
  hiddenColumns,
  renderCollapse,
  styles,
}: {
  item: T;
  hiddenColumns: Column<T>[];
  renderCollapse?: (item: T) => React.ReactNode;
  styles: CollapsibleTableStyles;
}) {
  return (
    <View style={styles.collapseBox}>
      <View style={styles.kvGrid}>
        {hiddenColumns.map((col) => (
          <View key={String(col.key)} style={styles.kvRow}>
            <TextBase style={styles.kvKey}>{col.label} : </TextBase>
            <TextBase style={styles.kvValue}>{String(item[col.key] ?? '')}</TextBase>
          </View>
        ))}
      </View>
      {renderCollapse && renderCollapse(item) && (
        <View style={styles.customCollapse}>{renderCollapse(item)}</View>
      )}
    </View>
  );
}