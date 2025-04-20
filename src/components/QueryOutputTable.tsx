import React, { useRef, useEffect } from 'react';

interface TableRow {
  [key: string]: string | number | null;
}

interface QueryOutputTableProps {
  results: Record<string, TableRow[]> | null;
  maxHeight: number;
}

const QueryOutputTable: React.FC<QueryOutputTableProps> = ({ results, maxHeight }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Adjust scrolling when results change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [results]);
  
  if (!results || Object.keys(results).length === 0) {
    return (
      <div 
        className="flex items-center justify-center"
        style={{ 
          height: `${maxHeight}px`,
          maxHeight: `${maxHeight}px` 
        }}
      >
        <p style={{ textAlign: 'center', color: 'gray' }}>No output available</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        maxHeight: `${maxHeight}px`,
        height: `${maxHeight}px`,
        overflow: 'auto',
        width: '100%' // Ensure container takes full width of parent
      }}
    >
      {Object.entries(results).map(([tableName, rows]) => (
        <div key={tableName} style={{ 
          marginBottom: '16px',
          width: '100%' // Ensure the table container doesn't expand beyond parent
        }}>
          {tableName && (
            <div style={{ 
              fontWeight: 'bold', 
              padding: '4px 8px', 
              backgroundColor: '#e9e9e9', 
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={tableName}
            >
              {tableName}
            </div>
          )}
          {rows && rows.length > 0 ? (
            <div style={{ 
              overflowX: 'auto',
              width: '100%',
              maxWidth: '100%'
            }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                maxWidth: '100%'
              }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    {Object.keys(rows[0]).map((col, index) => {
                      // Calculate reasonable column width based on number of columns
                      const columnWidth = `${Math.max(100 / Object.keys(rows[0]).length, 10)}%`;
                      
                      return (
                        <th 
                          key={index} 
                          style={{
                            border: '1px solid #ddd',
                            padding: '8px',
                            backgroundColor: '#f2f2f2',
                            textAlign: 'left',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: columnWidth,
                            maxWidth: columnWidth
                          }}
                          title={col}
                        >
                          {col}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {Object.entries(row).map(([key, cell]) => {
                        // Match column width from header
                        const columnWidth = `${Math.max(100 / Object.keys(rows[0]).length, 10)}%`;
                        
                        return (
                          <td 
                            key={key} 
                            data-label={key}
                            style={{
                              border: '1px solid #ddd',
                              padding: '8px',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              width: columnWidth,
                              maxWidth: columnWidth
                            }}
                            title={cell?.toString() || "NULL"}
                          >
                            {cell?.toString() || "NULL"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
              <p style={{ textAlign: 'center', color: 'gray' }}>Operation completed successfully. No rows returned.</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default QueryOutputTable;