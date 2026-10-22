
import sql from 'mssql';
import dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

dotenv.config({ path: join(root, '.env.erd') });

const env = process.env;

for (const key of [
  'DB_SERVER',
  'DB_DATABASE',
  'DB_USER',
  'DB_PASSWORD'
]) {
  if (!env[key]) {
    throw new Error(`Falta ${key} en .env.erd`);
  }
}

const config = {
  server: env.DB_SERVER,
  port: Number(env.DB_PORT || 1433),
  database: env.DB_DATABASE,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate:
      env.DB_TRUST_SERVER_CERT === 'true'
  },
  connectionTimeout: 15000,
  requestTimeout: 30000
};

// Tablas, columnas, tipos y claves primarias.
const columnsQuery = `
SELECT
    s.name AS SchemaName,
    t.name AS TableName,
    c.name AS ColumnName,
    ty.name AS DataType,
    c.max_length AS MaxLength,
    c.precision AS NumericPrecision,
    c.scale AS NumericScale,
    c.is_nullable AS IsNullable,
    CASE WHEN EXISTS (
        SELECT 1
        FROM sys.indexes i
        JOIN sys.index_columns ic
          ON ic.object_id = i.object_id
         AND ic.index_id = i.index_id
        WHERE i.object_id = t.object_id
          AND i.is_primary_key = 1
          AND ic.column_id = c.column_id
          AND ic.key_ordinal > 0
    ) THEN 1 ELSE 0 END AS IsPrimaryKey
FROM sys.tables t
JOIN sys.schemas s
  ON s.schema_id = t.schema_id
JOIN sys.columns c
  ON c.object_id = t.object_id
JOIN sys.types ty
  ON ty.user_type_id = c.user_type_id
WHERE t.is_ms_shipped = 0
ORDER BY s.name, t.name, c.column_id;
`;

// Claves foráneas y columnas relacionadas.
const foreignKeysQuery = `
SELECT
    fk.object_id AS ForeignKeyId,
    fk.name AS ForeignKeyName,
    ps.name AS ParentSchema,
    pt.name AS ParentTable,
    pc.name AS ParentColumn,
    rs.name AS ReferencedSchema,
    rt.name AS ReferencedTable,
    rc.name AS ReferencedColumn
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc
  ON fkc.constraint_object_id = fk.object_id
JOIN sys.tables pt
  ON pt.object_id = fk.parent_object_id
JOIN sys.schemas ps
  ON ps.schema_id = pt.schema_id
JOIN sys.columns pc
  ON pc.object_id = pt.object_id
 AND pc.column_id = fkc.parent_column_id
JOIN sys.tables rt
  ON rt.object_id = fk.referenced_object_id
JOIN sys.schemas rs
  ON rs.schema_id = rt.schema_id
JOIN sys.columns rc
  ON rc.object_id = rt.object_id
 AND rc.column_id = fkc.referenced_column_id
ORDER BY fk.object_id, fkc.constraint_column_id;
`;

function formatType(c) {
  const type = c.DataType.toLowerCase();

  if (['nvarchar', 'nchar'].includes(type)) {
    const length = c.MaxLength === -1
      ? 'max' : c.MaxLength / 2;
    return `${type}(${length})`;
  }

  if (['varchar', 'char', 'varbinary',
       'binary'].includes(type)) {
    const length = c.MaxLength === -1
      ? 'max' : c.MaxLength;
    return `${type}(${length})`;
  }

  if (['decimal', 'numeric'].includes(type)) {
    return `${type}(${c.NumericPrecision},${c.NumericScale})`;
  }

  return c.DataType;
}

let pool;

try {
  console.log('Conectando a SQL Server por VPN...');

  pool = await new sql.ConnectionPool(config).connect();

  console.log('Conexión SQL establecida.');

  const columns = (await pool.request()
    .query(columnsQuery)).recordset;

  const foreignKeys = (await pool.request()
    .query(foreignKeysQuery)).recordset;

  if (!columns.length) {
    throw new Error(
      'No se encontraron tablas. Comprueba la base y los permisos.'
    );
  }

  // Identificar columnas que participan en una FK.
  const fkColumns = new Set(
    foreignKeys.map(f =>
      `${f.ParentSchema}.${f.ParentTable}.${f.ParentColumn}`
    )
  );

  const tableMap = new Map();

  for (const col of columns) {
    const id = `${col.SchemaName}.${col.TableName}`;

    if (!tableMap.has(id)) {
      tableMap.set(id, {
        id,
        type: 'entity',
        position: { x: 0, y: 0 },
        data: {
          table: id,
          columns: []
        }
      });
    }

    const pk = col.IsPrimaryKey === 1;
    const fk = fkColumns.has(`${id}.${col.ColumnName}`);

    tableMap.get(id).data.columns.push({
      name: col.ColumnName,
      type: formatType(col),
      key: pk && fk ? 'PK/FK' :
           pk ? 'PK' : fk ? 'FK' : '',
      nullable: Boolean(col.IsNullable)
    });
  }

  const nodes = [...tableMap.values()];

  // Posicionar las tablas por filas de tres.
  let y = 50;

  for (let i = 0; i < nodes.length; i += 3) {
    const row = nodes.slice(i, i + 3);

    row.forEach((node, j) => {
      node.position = {
        x: 50 + j * 360,
        y
      };
    });

    y += Math.max(
      ...row.map(n => 85 + n.data.columns.length * 28)
    ) + 90;
  }

  // Agrupar FK compuestas como una sola relación.
  const relations = new Map();

  for (const fk of foreignKeys) {
    if (!relations.has(fk.ForeignKeyId)) {
      relations.set(fk.ForeignKeyId, {
        id: `fk-${fk.ForeignKeyId}`,
        source:
          `${fk.ReferencedSchema}.${fk.ReferencedTable}`,
        target:
          `${fk.ParentSchema}.${fk.ParentTable}`,
        type: 'smoothstep',
        label: 'FK',
        data: {
          name: fk.ForeignKeyName,
          columns: []
        }
      });
    }

    relations.get(fk.ForeignKeyId).data.columns.push({
      from: fk.ParentColumn,
      to: fk.ReferencedColumn
    });
  }

  const edges = [...relations.values()];

  const directory = join(root, 'public', 'schema');
  await mkdir(directory, { recursive: true });

  const output = join(directory, 'erd.json');

  await writeFile(
    output,
    JSON.stringify({
      database: env.DB_DATABASE,
      generatedAt: new Date().toISOString(),
      nodes,
      edges
    }, null, 2),
    'utf8'
  );

  console.log(`Tablas encontradas: ${nodes.length}`);
  console.log(`Relaciones FK: ${edges.length}`);
  console.log(`Archivo generado: ${output}`);

} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  if (pool) {
    await pool.close();
  }
}
