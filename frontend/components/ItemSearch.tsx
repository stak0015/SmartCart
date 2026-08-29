"use client";

import { useState, useEffect, useCallback } from "react";
import { searchItems, type Item } from "@/lib/api";

/**
 * Item Search Component
 * Implements AC-1.1.1, AC-1.1.3, AC-1.1.4, AC-1.1.5
 */
export default function ItemSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination and statistics state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Core search function that accepts page parameter
  const performSearch = useCallback(async (searchQuery: string, page: number) => {
    setError(null);
    
    const trimmedQuery = searchQuery.trim();
    
    // AC-1.1.1: If input is not empty but less than 2 chars, do not call API
    if (trimmedQuery.length > 0 && trimmedQuery.length < 2) {
      setResults([]);
      setTotalCount(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Call real API with current page number
      const data = await searchItems(trimmedQuery, page);
      setResults(data.items);
      setTotalPages(data.total_pages);
      setTotalCount(data.total);
      setCurrentPage(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search error");
      setResults([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-search logic with debounce
  useEffect(() => {
    // Reset to page 1 whenever query changes
    setCurrentPage(1);
    
    const trimmedQuery = query.trim();
    
    // AC-1.1.5: If query is empty, fetch all items on page 1 immediately
    if (trimmedQuery === "") {
      performSearch("", 1);
      return;
    }

    // AC-1.1.1: If less than 2 chars, do not trigger API
    if (trimmedQuery.length < 2) {
      setResults([]);
      setTotalCount(0);
      setTotalPages(1);
      return;
    }

    // Debounce: execute search after 300ms
    const timer = setTimeout(() => {
      performSearch(trimmedQuery, 1);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || loading) return;
    setCurrentPage(newPage);
    performSearch(query, newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Determine if short query hint should be shown
  const showShortQueryHint = query.trim().length > 0 && query.trim().length < 2 && !loading;

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-3">Search Items</h2>

      {/* Search input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter item name or category (min 2 chars), or leave empty for all..."
          className="flex-1 border rounded px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => performSearch(query, 1)}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="text-red-500 mb-3 bg-red-50 p-2 rounded">Error: {error}</div>
      )}

      {/* AC-1.1.1: Short query hint */}
      {showShortQueryHint && (
        <div className="text-amber-600 mb-3 text-sm">
          Please enter at least 2 characters to search, or clear the box to see all items.
        </div>
      )}

      {/* Loading state */}
      {loading && <div className="text-gray-500 py-4 text-center">Searching...</div>}

      {/* AC-1.1.4: No results message */}
      {!loading && !showShortQueryHint && !error && totalCount === 0 && (
        <div className="text-gray-500 py-8 text-center bg-gray-50 rounded-lg">
          No items found. Try another keyword or category.
        </div>
      )}

      {/* Results list */}
      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-gray-500 font-medium mb-2">
            Found {totalCount} items (Page {currentPage} of {totalPages})
          </div>
          
          {results.map((item) => (
            <div
              key={item.item_id}
              className="border rounded p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="font-semibold text-black">{item.item_name}</div>
              <div className="text-sm text-gray-600 mt-1">
                {item.item_category && <span>Category: {item.item_category}</span>}
                {item.unit && <span className="ml-3">Unit: {item.unit}</span>}
                {item.package_size && <span className="ml-3">Size: {item.package_size}</span>}
              </div>
            </div>
          ))}

          {/* AC-1.1.3: Pagination UI */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6 pt-4 border-t">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Prev
              </button>
              
              <span className="text-sm text-gray-600 px-2">
                {currentPage} / {totalPages}
              </span>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}