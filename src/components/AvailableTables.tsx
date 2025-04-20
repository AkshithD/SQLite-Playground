import React, { useState, useEffect, useRef } from 'react';

interface TableRow {
    [key: string]: string | number | null;
  }

interface AvailableTablesProps {
    tables: Record<string, TableRow[]>;
    maxHeight: number;
  }
  

const AvailableTables: React.FC<AvailableTablesProps> = ({ tables, maxHeight }) => {
    const tableNames = Object.keys(tables);
    const [selectedTable, setSelectedTable] = useState<string>(tableNames[0] || "");
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Update selected table when tables change
    useEffect(() => {
      if (tableNames.length > 0 && !tableNames.includes(selectedTable)) {
        setSelectedTable(tableNames[0]);
      }
    }, [tables, tableNames, selectedTable]);
    
    const handleTableChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedTable(event.target.value);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="mb-3">
                <select
                onChange={handleTableChange}
                value={selectedTable}
                style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    borderRadius: '4px',
                    border: '1px solid #ccc'
                }}
                >
                {tableNames.length > 0 ? (
                  tableNames.map((table) => (
                      <option key={table} value={table}>
                      {table}
                      </option>
                  ))
                ) : (
                  <option value="">No tables available</option>
                )}
                </select>
            </div>

      {selectedTable && tables[selectedTable]?.length > 0 ? (
        <div 
          ref={containerRef}
          className="flex-grow overflow-auto"
          style={{ 
            maxHeight: `${maxHeight}px`,
            height: `${maxHeight}px`,
          }}
        >
        <table 
          className="w-full border-collapse"
          style={{
            tableLayout: 'fixed'
          }}
        >
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr>
              {Object.keys(tables[selectedTable][0]).map((key) => (
                <th 
                  key={key}
                  style={{
                    border: '1px solid #ddd',
                    padding: '8px',
                    backgroundColor: '#f2f2f2',
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={key}
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tables[selectedTable].map((row, index) => (
              <tr key={index}>
                {Object.entries(row).map(([key, value]) => (
                  <td 
                    key={key} 
                    data-label={key}
                    style={{
                      border: '1px solid #ddd',
                      padding: '8px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={value?.toString() || "NULL"}
                  >
                    {value?.toString() || "NULL"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      ) : (
        <div 
          className="flex-grow flex items-center justify-center"
          style={{ 
            maxHeight: `${maxHeight}px`,
            height: `${maxHeight}px`,
          }}
        >
          <p style={{ textAlign: "center", color: "gray" }}>No data available</p>
        </div>
      )}
    </div>
  );
};

export default AvailableTables;