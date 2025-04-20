import {useEffect, useState, useRef, useLayoutEffect } from 'react'
import Editor from "@monaco-editor/react";
import initSqlJs, { Database } from "sql.js";
import Navbar from './components/Navbar';
import AvailableTables from "./components/AvailableTables.tsx";
import QueryOutputTable from './components/QueryOutputTable.tsx';
import SchemaViewer from './components/SchemaViewer';

interface TableRow {
  [key: string]: string | number | null;
}

interface TableSchema {
  name: string;
  columns: {
    name: string;
    type: string;
    notNull: boolean;
    defaultValue: string | null;
    primaryKey: boolean;
  }[];
  foreignKeys: {
    id: string;
    columnName: string;
    referencedTable: string;
    referencedColumn: string;
  }[];
}

function App() {
  const [db, setDb] = useState<Database | null>(null); // SQLite database
  const [file, setFile] = useState<File | null>(null);
  const [leftWidth, setLeftWidth] = useState(0.3); // 30% of total width
  const [topHeightLeft, setTopHeightLeft] = useState(0.5); // 50% of left section
  const [topHeightRight, setTopHeightRight] = useState(0.5); // 50% of right section
  const [editorContent, setEditorContent] = useState("-- Write your SQL here");
  const [tables, setTables] = useState<Record<string, TableRow[]>>({});
  const [tableSchemas, setTableSchemas] = useState<TableSchema[]>([]);
  const [queryResults, setQueryResults] = useState<Record<string, TableRow[]> | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryMessage, setQueryMessage] = useState<string | null>(null);
  const minFraction = 0.2;
  const maxFraction = 0.8;
  
  // References to container elements for dynamic height calculations
  const leftTopContainerRef = useRef<HTMLDivElement>(null);
  const rightBottomContainerRef = useRef<HTMLDivElement>(null);
  const leftSectionRef = useRef<HTMLDivElement>(null);
  const horizontalResizerRef = useRef<HTMLDivElement>(null);

  // Function to download the current database state
  const downloadDatabase = () => {
    if (!db) {
      alert("No database to download. Please create tables or load a database first.");
      return;
    }

    try {
      // Export the database to a Uint8Array
      const data = db.export();
      
      // Create a blob from the data
      const blob = new Blob([data], { type: 'application/x-sqlite3' });
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a download link and trigger the download
      const a = document.createElement('a');
      a.href = url;
      
      // Set the filename - use the original filename if available, or a default
      const fileName = file ? file.name : 'sql-playground-export.sqlite';
      a.download = fileName;
      
      // Append the link to the body, click it, and remove it
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Release the URL object
      URL.revokeObjectURL(url);
      
      // Show a success message
      alert(`Database "${fileName}" downloaded successfully!`);
    } catch (err) {
      console.error("Error downloading database:", err);
      alert(`Error downloading database: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Function to clear the current database and start fresh
  const clearDatabase = async () => {
    try {
      // Load sql.js to create a new empty database
      const SQL = await initSqlJs({ locateFile: () => "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm" });
      
      // Create a new empty database
      const newDb = new SQL.Database();
      setDb(newDb);
      
      // Reset associated state
      setFile(null);
      setTables({});
      setTableSchemas([]);
      setQueryResults(null);
      setQueryError(null);
      setQueryMessage(null);
      setEditorContent("-- Write your SQL here");
      
      // Show a success message
      setQueryMessage("Database cleared successfully. Start with a fresh database.");
    } catch (err) {
      console.error("Error clearing database:", err);
      alert(`Error clearing database: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Preserve layout on window resize
  useLayoutEffect(() => {
    const handleResize = () => {
      // Force re-render to update layout calculations
      if (leftSectionRef.current) {
        const currentLeftWidth = leftSectionRef.current.style.width;
        // Reapply the width to maintain stability
        leftSectionRef.current.style.width = currentLeftWidth;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadSqlJs = async () => {
      const SQL = await initSqlJs({ locateFile: () => "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm" });
      if (file) {
        // Read file as ArrayBuffer
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            const uint8Array = new Uint8Array(event.target.result as ArrayBuffer);
            setDb(new SQL.Database(uint8Array)); // Load the database from file
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setDb(new SQL.Database()); // Empty in-memory DB
      }
    };
    loadSqlJs();
  }, [file]);

  useEffect(() => {
    if (db) {
      fetchTables();
      fetchTableSchemas();
    }
  }, [db]);
  
  const fetchTables = () => {
    if (!db) return;
    try {
      const tableQuery = db.exec("SELECT name FROM sqlite_master WHERE type='table';");
  
      // Ensure values exist and filter out non-string table names
      const tableNames = tableQuery[0]?.values.map((row) => row[0] as string) || [];
  
      const tableData: Record<string, TableRow[]> = {};
  
      tableNames.forEach((table: string) => {
        const result = db.exec(`SELECT * FROM "${table}";`); // Use quotes to avoid reserved words issue
        if (result.length > 0) {
          const columns = result[0].columns;
          const values = result[0].values;
          tableData[table] = values.map(row => Object.fromEntries(columns.map((col, i) => [col, convertSqlValue(row[i])])));
        } else {
          tableData[table] = [];
        }
      });
  
      setTables(tableData);
    } catch (err) {
      console.error("Error fetching tables:", err);
    }
  };
  
  const fetchTableSchemas = () => {
    if (!db) return;
    
    try {
      // Get all tables
      const tableQuery = db.exec("SELECT name FROM sqlite_master WHERE type='table';");
      const tableNames = tableQuery[0]?.values.map((row) => row[0] as string) || [];
      
      const schemas: TableSchema[] = [];
      
      // For each table, get its column information
      tableNames.forEach(tableName => {
        try {
          // PRAGMA table_info is a SQLite command that returns column info for a table
          const columnInfo = db.exec(`PRAGMA table_info("${tableName}");`);
          
          if (columnInfo.length > 0) {
            const columns = columnInfo[0].values.map(col => ({
              name: col[1] as string,                 // column name
              type: col[2] as string,                 // data type
              notNull: Boolean(col[3]),               // NOT NULL constraint
              defaultValue: col[4] as string | null,  // default value
              primaryKey: Boolean(col[5])             // primary key
            }));
            
            // Get foreign key information using PRAGMA foreign_key_list
            const foreignKeyInfo = db.exec(`PRAGMA foreign_key_list("${tableName}");`);
            const foreignKeys = foreignKeyInfo.length > 0 
              ? foreignKeyInfo[0].values.map((fk, index) => ({
                  id: `${tableName}_fk_${index}`,
                  columnName: fk[3] as string,           // column name in this table
                  referencedTable: fk[2] as string,      // referenced table
                  referencedColumn: fk[4] as string      // referenced column
                }))
              : [];
            
            schemas.push({
              name: tableName,
              columns,
              foreignKeys
            });
          }
        } catch (columnErr) {
          console.error(`Error fetching schema for table ${tableName}:`, columnErr);
        }
      });
      
      setTableSchemas(schemas);
    } catch (err) {
      console.error("Error fetching table schemas:", err);
    }
  };
  
  // Function to safely convert SQL values
  const convertSqlValue = (value: string | number | null | Uint8Array): string | number | null => {
    if (value instanceof Uint8Array) {
      return new TextDecoder().decode(value); // Convert binary data to string
    }
    return value;
  };
  
  // Parse the query to detect DML statements
  const isDMLQuery = (query: string): boolean => {
    const dmlPatterns = [
      /^\s*INSERT\s+INTO/i, 
      /^\s*UPDATE\s+/i, 
      /^\s*DELETE\s+FROM/i, 
      /^\s*CREATE\s+TABLE/i,
      /^\s*DROP\s+TABLE/i,
      /^\s*ALTER\s+TABLE/i
    ];
    
    // Check if the query matches any DML pattern
    return dmlPatterns.some(pattern => pattern.test(query));
  };

  const executeQuery = () => {
    if (!db) return;
    
    // Reset previous errors and results
    setQueryError(null);
    setQueryMessage(null);
    
    try {
      // Preserve the current layout dimensions
      const currentLeftWidth = leftWidth;
      
      // Try to identify if this is a DML statement (INSERT, UPDATE, DELETE, etc.)
      const isDML = isDMLQuery(editorContent);
      
      // For DML statements, we'll use run() instead of exec() and get the number of changes
      if (isDML) {
        try {
          db.run(editorContent);
          const rowsChanged = db.getRowsModified();
          setQueryResults({});
          setQueryMessage(`Query executed successfully. Rows affected: ${rowsChanged}`);
        } catch (dmlError: Error | unknown) {
          const errorMessage = dmlError instanceof Error 
            ? dmlError.message 
            : String(dmlError);
          setQueryError(`SQL Error: ${errorMessage}`);
          console.error("SQL DML Error:", dmlError);
        }
      } else {
        // For SELECT statements, use exec() as before
        const result = db.exec(editorContent);
        console.log("Query Result:", result);
        
        if (result.length > 0) {
          const tableData: Record<string, TableRow[]> = {};
          result.forEach((table) => {
            tableData[table.columns.join(", ")] = table.values.map((row) =>
              Object.fromEntries(table.columns.map((col, index) => {
                let value = row[index];
                if (value instanceof Uint8Array) {
                  value = new TextDecoder().decode(value);
                }
                return [col, value as string | number | null];
              }))
            );
          });
          setQueryResults(tableData);
        } else {
          setQueryResults({});
          setQueryMessage("Query executed successfully. No rows returned.");
        }
      }
      
      // After executing query, refetch tables and schema data to ensure they're in sync
      fetchTables();
      fetchTableSchemas();
      
      // Re-apply the layout dimensions to maintain stability
      setLeftWidth(currentLeftWidth);
      
      // Ensure the resizer is visible and interactive
      if (horizontalResizerRef.current) {
        horizontalResizerRef.current.style.zIndex = '10';
      }
    } catch (err: Error | unknown) {
      console.error("SQL Execution Error:", err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : String(err);
      setQueryError(`SQL Error: ${errorMessage}`);
      setQueryResults({});
      
      // Even on error, ensure tables data is maintained
      fetchTables();
      fetchTableSchemas();
    }
  };
  
  const handleHorizontalResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.cursor = "ew-resize";

    const startX = e.clientX;
    const startFraction = leftWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      
      const delta = (moveEvent.clientX - startX) / window.innerWidth;
      const newFraction = Math.max(minFraction, Math.min(maxFraction, startFraction + delta));
      setLeftWidth(newFraction);
      
      if (leftSectionRef.current) {
        leftSectionRef.current.style.width = `${newFraction * 100}%`;
      }
    };

    const onMouseUp = () => {
      document.body.style.cursor = "default";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleVerticalResize = (
    e: React.MouseEvent,
    setHeight: (h: number) => void,
    startHeight: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.cursor = "ns-resize";
  
    const startY = e.clientY;
    const onMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      
      const delta = (moveEvent.clientY - startY) / window.innerHeight;
      const newFraction = Math.max(minFraction, Math.min(maxFraction, startHeight + delta));
  
      setHeight(newFraction);
    };
  
    const onMouseUp = () => {
      document.body.style.cursor = "default";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Calculate available height for tables based on container dimensions
  const getLeftTableHeight = () => {
    if (!leftTopContainerRef.current) return 300; // Default fallback
    return leftTopContainerRef.current.clientHeight - 60; // Account for header/padding
  };

  const getRightTableHeight = () => {
    if (!rightBottomContainerRef.current) return 300; // Default fallback
    return rightBottomContainerRef.current.clientHeight - 40; // Account for header
  };
  
  return (
    <div className="flex flex-col h-screen">
      <Navbar onFileSelect={setFile} onDownloadDb={downloadDatabase} onClearDb={clearDatabase} />
      <div className="flex flex-grow w-full text-black overflow-hidden">
        {/* Left Section */}
        <div 
          ref={leftSectionRef}
          style={{ 
            width: `${leftWidth * 100}%`, 
            minWidth: `${minFraction * 100}%`,
            maxWidth: `${maxFraction * 100}%`,
            flexShrink: 0,
            flexGrow: 0
          }} 
          className="flex flex-col border-r relative overflow-hidden"
        >
          <div 
            ref={leftTopContainerRef}
            style={{ height: `${topHeightLeft * 100}%` }} 
            className="bg-gray-100 overflow-hidden flex flex-col"
          >
            <div className="p-2 text-lg font-semibold">Available Tables</div>
            <div className="flex-grow overflow-hidden">
              <AvailableTables 
                tables={tables} 
                maxHeight={getLeftTableHeight()} 
              />
            </div>
          </div>
          
          {/* Resizer between the two sections */}
          <div
            onMouseDown={(e) => handleVerticalResize(e, setTopHeightLeft, topHeightLeft)}
            className="h-2 cursor-row-resize bg-gray-300 hover:bg-gray-400"
          ></div>
          
          {/* Schema Viewer now properly below the resizer */}
          <div className="flex-grow p-2 overflow-auto bg-gray-200">
            <SchemaViewer tables={tableSchemas} />
          </div>
        </div>

        {/* Horizontal Resizer */}
        <div
          ref={horizontalResizerRef}
          onMouseDown={handleHorizontalResize}
          style={{
            width: '8px',
            flexShrink: 0,
            flexGrow: 0,
            zIndex: 10,
            cursor: 'col-resize'
          }}
          className="bg-gray-400 hover:bg-gray-500"
        ></div>

        {/* Right Section */}
        <div className="flex flex-col flex-grow overflow-hidden">
          <div style={{ height: `${topHeightRight * 100}%` }} className="relative overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={editorContent}
              onChange={(newValue) => setEditorContent(newValue || "")}
              theme="vs-dark"
              options={{
                automaticLayout: true,
                wordWrap: "on",
                minimap: { enabled: false }
              }}
            />
            <button 
              onClick={executeQuery} 
              className="absolute bottom-2 right-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 z-10"
            >
              Run SQL
            </button>
          </div>

          {/* Vertical resizer for the right section */}
          <div
            onMouseDown={(e) => handleVerticalResize(e, setTopHeightRight, topHeightRight)}
            className="h-2 cursor-row-resize bg-gray-300 hover:bg-gray-400"
            style={{ zIndex: 5 }}
          ></div>
          
          <div 
            ref={rightBottomContainerRef}
            className="flex-grow bg-gray-200 overflow-hidden flex flex-col"
          >
            <div className="p-2 text-lg font-semibold">Query Results</div>
            <div className="flex-grow overflow-hidden">
              {queryError ? (
                <div 
                  style={{ 
                    padding: '12px', 
                    backgroundColor: '#fef2f2', 
                    border: '1px solid #f87171',
                    borderRadius: '4px',
                    margin: '8px',
                    color: '#b91c1c'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Error</div>
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-word',
                    overflowX: 'auto'
                  }}>
                    {queryError}
                  </pre>
                </div>
              ) : queryMessage ? (
                <div 
                  style={{ 
                    padding: '12px', 
                    backgroundColor: '#ecfdf5', 
                    border: '1px solid #6ee7b7',
                    borderRadius: '4px',
                    margin: '8px',
                    color: '#065f46'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Success</div>
                  <div>{queryMessage}</div>
                </div>
              ) : (
                <QueryOutputTable 
                  results={queryResults} 
                  maxHeight={getRightTableHeight()} 
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App
