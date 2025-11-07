import React, { useState, useEffect } from "react";

interface PaginationProps {
  itemsPerPage: number;
  totalItems: number;
  currentPage: number;
  paginate: (pageNumber: number) => void;
  
  setItemsPerPage: (size: number) => void; 
}

const PaginationComponent = ({
  itemsPerPage,
  totalItems,
  currentPage,
  paginate,
  setItemsPerPage, 
}: PaginationProps) => {
  const totalPages = Math.max(Math.ceil(totalItems / itemsPerPage), 1);


  const [pageInput, setPageInput] = useState(currentPage.toString());


  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);


  const nextPage = () => {
    if (currentPage < totalPages) {
      paginate(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      paginate(currentPage - 1);
    }
  };

 
  const handleGoToPage = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const pageNumber = parseInt(pageInput, 10);
      if (pageNumber >= 1 && pageNumber <= totalPages) {
        paginate(pageNumber);
      } else {
    
        setPageInput(currentPage.toString());
      }
    }
  };
  
 
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(e.target.value);
    setItemsPerPage(newSize);
  };

  
  const getPageNumbers = () => {
    const pageNumbers = [];
    const visiblePages = 3; 
    let startPage = Math.max(1, currentPage - Math.floor(visiblePages / 2));
    let endPage = Math.min(totalPages, startPage + visiblePages - 1);

    if (endPage - startPage + 1 < visiblePages) {
        startPage = Math.max(1, endPage - visiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
    }
    return pageNumbers;
  };

  if (totalPages <= 1) {
    return null; 
  }
  
  return (
    <div className="flex justify-between items-center mt-8 text-sm">
     
        <div className="flex items-center space-x-2">
            <label htmlFor="itemsPerPage" className="text-gray-600">Items per page:</label>
            <select
                id="itemsPerPage"
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="px-2 py-1 bg-white border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
            </select>
        </div>

        {/* Center: Pagination controls */}
        <div className="flex justify-center items-center space-x-2">
            <button
                onClick={prevPage}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
                Previous
            </button>

            {getPageNumbers().map((number) => (
                <button
                key={number}
                onClick={() => paginate(number)}
                className={`px-4 py-2 border rounded-md font-medium ${
                    currentPage === number
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
                >
                {number}
                </button>
            ))}

            <button
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
                Next
            </button>
        </div>
        
        {/* Right Side: Go to page input */}
        <div className="flex items-center space-x-2">
            <span className="text-gray-600">Go to page:</span>
            <input
                type="number"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={handleGoToPage}
                className="w-16 px-2 py-1 text-center bg-white border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-gray-500">of {totalPages}</span>
        </div>
    </div>
  );
};

export default PaginationComponent;
