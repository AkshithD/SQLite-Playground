import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, { 
  Background, 
  Node,
  Handle, 
  Position, 
  useNodesState,
  useEdgesState,
  NodeChange,
  Edge,
  MarkerType,
  ConnectionLineType,
  NodeDragHandler,
  useReactFlow,
  ReactFlowProvider,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';

interface TableColumn {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
}

interface ForeignKey {
  id: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

interface TableSchema {
  name: string;
  columns: TableColumn[];
  foreignKeys: ForeignKey[];
}

interface SchemaViewerProps {
  tables: TableSchema[];
}

// Custom node component to represent a table with its columns
const TableNode = ({ data }: { data: { table: TableSchema } }) => {
  const { table } = data;
  
  return (
    <div style={{ 
      border: '1px solid #ddd', 
      borderRadius: '5px', 
      padding: '0',
      background: 'white',
      minWidth: '220px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#555', visibility: 'hidden' }} />
      
      {/* Table name header */}
      <div style={{ 
        padding: '8px 10px', 
        background: '#f0f0f0', 
        borderBottom: '1px solid #ddd', 
        borderTopLeftRadius: '5px', 
        borderTopRightRadius: '5px',
        fontWeight: 'bold',
        textAlign: 'center'
      }}>
        {table.name}
      </div>
      
      {/* Column list */}
      <div style={{ padding: '5px 0' }}>
        {table.columns.map((column, i) => {
          // Check if this column is a foreign key
          const isForeignKey = table.foreignKeys.some(fk => fk.columnName === column.name);
          
          return (
            <div key={i} style={{ 
              padding: '4px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: i < table.columns.length - 1 ? '1px solid #eee' : 'none',
              position: 'relative'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                fontSize: '13px'
              }}>
                {column.primaryKey && (
                  <span style={{ 
                    color: 'gold', 
                    marginRight: '4px', 
                    fontSize: '16px'
                  }}>
                    🔑 
                  </span>
                )}
                {isForeignKey && (
                  <span style={{ 
                    color: '#3182ce', 
                    marginRight: '4px', 
                    fontSize: '14px'
                  }}>
                    🔗
                  </span>
                )}
                <span style={{ 
                  fontWeight: column.primaryKey ? 'bold' : 'normal',
                  color: isForeignKey ? '#3182ce' : 'inherit'
                }}>
                  {column.name}
                </span>
                {column.notNull && !column.primaryKey && (
                  <span style={{ color: '#888', fontSize: '10px', marginLeft: '4px' }}>
                    (NOT NULL)
                  </span>
                )}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#666',
                padding: '2px 6px',
                background: '#f8f8f8',
                borderRadius: '3px'
              }}>
                {column.type}
              </div>
              
              {/* Add handles for foreign key connections */}
              {isForeignKey && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`${table.name}-${column.name}-source`}
                  style={{ 
                    background: '#3182ce',
                    width: '8px',
                    height: '8px',
                    right: '-4px'
                  }}
                />
              )}
              
              {/* Add handles for primary keys that might be referenced */}
              {column.primaryKey && (
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`${table.name}-${column.name}-target`}
                  style={{ 
                    background: '#805ad5',
                    width: '8px',
                    height: '8px',
                    left: '-4px'
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      
      <Handle type="source" position={Position.Bottom} style={{ background: '#555', visibility: 'hidden' }} />
    </div>
  );
};

// Main flow component that handles the actual schema visualization
const SchemaFlow: React.FC<SchemaViewerProps> = ({ tables }) => {
  // Get ReactFlow instance for more direct control
  const reactFlowInstance = useReactFlow();
  
  // Maintain a ref to track user-positioned nodes
  const nodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  // Track whether nodes are currently being dragged
  const [isDragging, setIsDragging] = useState(false);
  
  // Generate initial nodes with improved layout, preserving positions of existing nodes
  const generateInitialNodes = (): Node[] => {
    return tables.map((table, index) => {
      // Default position - create a grid layout if no saved position
      let position;
      
      if (nodePositionsRef.current[table.name]) {
        // Use saved position if available
        position = nodePositionsRef.current[table.name];
      } else {
        // Create a better grid layout with more space between tables
        const row = Math.floor(index / 2);  // 2 tables per row instead of 3
        const col = index % 2;
        position = { 
          x: col * 350 + 50,  // Increased horizontal spacing
          y: row * 350 + 50   // Increased vertical spacing
        };
      }
      
      return {
        id: table.name,
        position,
        data: { table },
        type: 'tableNode',
        draggable: true,  // Make sure tables are draggable
      };
    });
  };

  // Generate edges from foreign key relationships
  const generateEdges = useCallback((): Edge[] => {
    const edges: Edge[] = [];
    
    tables.forEach(table => {
      // For each foreign key, create an edge
      table.foreignKeys.forEach(fk => {
        // Make sure the referenced table exists
        const referencedTableExists = tables.some(t => t.name === fk.referencedTable);
        if (!referencedTableExists) return;
        
        edges.push({
          id: fk.id,
          source: table.name,
          target: fk.referencedTable,
          sourceHandle: `${table.name}-${fk.columnName}-source`,
          targetHandle: `${fk.referencedTable}-${fk.referencedColumn}-target`,
          type: 'smoothstep',
          animated: true,
          label: `${fk.columnName} → ${fk.referencedColumn}`,
          labelStyle: { fill: '#666', fontSize: 10 },
          style: { stroke: '#3182ce', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
            color: '#3182ce',
          },
          zIndex: 0,
        });
      });
    });
    
    return edges;
  }, [tables]);

  // Use React Flow hooks to manage nodes and edges state
  const [nodes, setNodes, onNodesChange] = useNodesState(generateInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(generateEdges());

  // Handle node changes to track positions
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    // Let ReactFlow handle the node changes
    onNodesChange(changes);
    
    // Update our position cache when nodes are dragged
    changes.forEach(change => {
      if (change.type === 'position' && change.position && change.id) {
        nodePositionsRef.current[change.id] = { 
          x: change.position.x, 
          y: change.position.y 
        };
      }
    });
  }, [onNodesChange]);

  // Update edges continuously during drag to maintain connections
  const updateEdgesDuringDrag = useCallback(() => {
    if (isDragging) {
      // Update with completely regenerated edges to ensure consistent connections
      setEdges(generateEdges());
      // Schedule next update if still dragging
      requestAnimationFrame(updateEdgesDuringDrag);
    }
  }, [isDragging, setEdges, generateEdges]);

  // Re-create nodes when tables change, but preserve positions
  useEffect(() => {
    // First update the current positions from existing nodes
    nodes.forEach(node => {
      if (node.position) {
        nodePositionsRef.current[node.id] = { 
          x: node.position.x, 
          y: node.position.y 
        };
      }
    });
    
    // Then regenerate nodes with the updated positions
    setNodes(generateInitialNodes());
    
    // Also update edges for the foreign key relationships
    setEdges(generateEdges());
    
    // Only fit view when tables change, not during interaction
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.3, duration: 300 });
    }, 100);
  }, [tables, setNodes, setEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Add effect to monitor nodes and update edges when their positions change
  useEffect(() => {
    // This ensures edges maintain connections even after dragging is complete
    if (!isDragging) {
      setEdges(generateEdges());
    }
  }, [nodes, generateEdges, setEdges, isDragging]);

  // Define custom node types
  const nodeTypes = {
    tableNode: TableNode,
  };

  // Handle when node dragging starts
  const onNodeDragStart: NodeDragHandler = useCallback(() => {
    setIsDragging(true);
    // Start the continuous edge update loop
    requestAnimationFrame(updateEdgesDuringDrag);
  }, [updateEdgesDuringDrag]);

  // Handle during node dragging - update edges in real-time
  const onNodeDrag: NodeDragHandler = useCallback(() => {
    // Handled by the updateEdgesDuringDrag requestAnimationFrame loop
  }, []);

  // Handle when nodes are dropped after dragging
  const onNodeDragStop: NodeDragHandler = useCallback(() => {
    setIsDragging(false);
    
    // Store positions in localStorage for persistence between sessions
    try {
      localStorage.setItem('schemaViewerNodePositions', JSON.stringify(nodePositionsRef.current));
    } catch (e) {
      console.warn('Failed to save node positions to localStorage:', e);
    }
    
    // Immediately regenerate edges to ensure they stay visible
    setEdges(generateEdges());
  }, [setEdges, generateEdges]); // Add generateEdges to dependencies

  // Load saved positions from localStorage on initial render
  useEffect(() => {
    try {
      const savedPositions = localStorage.getItem('schemaViewerNodePositions');
      if (savedPositions) {
        nodePositionsRef.current = JSON.parse(savedPositions);
        // Re-generate nodes with saved positions
        setNodes(generateInitialNodes());
        
        // Also update edges with a short delay to ensure nodes are properly positioned
        setTimeout(() => {
          setEdges(generateEdges());
        }, 100);
      }
    } catch (e) {
      console.warn('Failed to load saved node positions:', e);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ReactFlow 
      nodes={nodes} 
      edges={edges} 
      nodeTypes={nodeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStart={onNodeDragStart}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      fitView={false} // Disable automatic fitView completely
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.1}
      maxZoom={1.5}
      defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
      connectionLineType={ConnectionLineType.SmoothStep}
      elementsSelectable={true}
      nodesDraggable={true}
      zoomOnScroll={true}
      panOnScroll={true}
      style={{ 
        background: '#fafafa', 
        width: '100%', 
        height: '100%'
      }}
    >
      <Background color="#f0f0f0" gap={16} />
      <Panel position="top-right">
        <button
          onClick={() => reactFlowInstance.fitView({ padding: 0.3, duration: 500 })}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
          style={{ opacity: 0.8 }}
        >
          Fit View
        </button>
      </Panel>
    </ReactFlow>
  );
};

// Wrapper component to provide ReactFlow context
const SchemaViewer: React.FC<SchemaViewerProps> = ({ tables }) => {
  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <ReactFlowProvider>
        <SchemaFlow tables={tables} />
      </ReactFlowProvider>
      <div style={{ 
        position: 'absolute', 
        bottom: '10px', 
        left: '10px', 
        background: 'rgba(255,255,255,0.8)', 
        padding: '5px 10px', 
        borderRadius: '4px',
        fontSize: '12px',
        color: '#666',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        zIndex: 10
      }}>
        <div>🔑 Primary Key | 🔗 Foreign Key</div>
        <div>Tip: Drag tables to rearrange them</div>
      </div>
    </div>
  );
};

export default SchemaViewer;
