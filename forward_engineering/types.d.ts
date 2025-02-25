export type ColumnDefinition = {
  name: string;
  type: string;
  isActivated: boolean;
  length?: number;
  precision?: number;
  primaryKey?: boolean;
  scale?: number;
  timePrecision?: number;
  unique?: boolean;
};

export type ConstraintDtoColumn = {
  name: string;
  isActivated: boolean;
};

export type KeyType = 'PRIMARY KEY' | 'UNIQUE';

export type ConstraintDto = {
  keyType: KeyType;
  name: string;
  columns?: ConstraintDtoColumn[];
};

export type JsonSchema = Record<string, unknown>;
