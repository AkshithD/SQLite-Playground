import { useState } from "react";

interface NavbarProps {
  onFileSelect: (file: File | null) => void;
  onDownloadDb: () => void;
  onClearDb: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onFileSelect, onDownloadDb, onClearDb }) => {
  const [fileName, setFileName] = useState("Select a database file");

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setFileName(file.name);
      onFileSelect(file); // Pass file to the parent
    }
  };

  const handleClearDb = () => {
    if (window.confirm("Are you sure you want to clear the database? This will delete all tables and data.")) {
      onClearDb();
      setFileName("New Database");
    }
  };

  return (
    <nav className="flex justify-between items-center bg-gray-800 text-white p-4">
      <span className="text-lg font-semibold">{fileName}</span>
      <div className="flex space-x-3">
        <button 
          onClick={handleClearDb}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded cursor-pointer"
        >
          Clear DB
        </button>
        <button 
          onClick={onDownloadDb}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded cursor-pointer"
        >
          Download DB
        </button>
        <label className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded cursor-pointer">
          Select File
          <input
            type="file"
            accept=".sqlite,.db"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>
    </nav>
  );
};

export default Navbar;
