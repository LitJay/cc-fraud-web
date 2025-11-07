import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionPage, { Txn } from '../transaction/page'; // Adjust path as needed

// Mock child components and global fetch
jest.mock('../component/GeneralAlert/GeneralAlert', () => ({
  __esModule: true,
  default: jest.fn(),
  AlertMode: {
    Error: 2,
  },
}));
jest.mock('../component/Types/LoadingView', () => () => <div data-testid="loader">Loading...</div>);
jest.mock('../component/Types/ErrorView', () => () => <div>Something went wrong</div>);

const mockTransactions: Txn[] = [
  { record_id: 1, trans_date_trans_time: '2023-10-27 10:00:00', amt: 123.45, is_fraud: 1, cc_num: 1111222233334444, merchant: 'Tech Store', category: 'Electronics', first: 'John', last: 'Doe', gender: 'M', street: '123 Main St', city: 'Testville', state: 'TS', zip: 12345, lat: 0, long: 0, city_pop: 10000, job: 'Engineer', dob: '1990-01-01', unix_time: 0, merch_lat: 0, merch_long: 0 },
  { record_id: 2, trans_date_trans_time: '2023-10-26 15:30:00', amt: 50.0, is_fraud: 0, cc_num: 5555666677778888, merchant: 'Coffee Shop', category: 'Food', first: 'Jane', last: 'Smith', gender: 'F', street: '456 Oak Ave', city: 'Testburg', state: 'TS', zip: 54321, lat: 0, long: 0, city_pop: 20000, job: 'Designer', dob: '1992-05-05', unix_time: 0, merch_lat: 0, merch_long: 0 },
];

// Mock the global fetch function
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'fake-token');
});

describe('TransactionPage', () => {
  const user = userEvent.setup();

  test('fetches and displays transactions successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTransactions,
    });
    render(<TransactionPage />);
    expect(await screen.findByText('2023-10-27 10:00:00')).toBeInTheDocument();
    expect(screen.getByText('$123.45')).toBeInTheDocument();
    expect(screen.getByText('Fraud')).toBeInTheDocument();
  });

  test('filters transactions by CC number search', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTransactions,
    });
    render(<TransactionPage />);
    await screen.findByText('2023-10-27 10:00:00'); // Wait for initial load

    const searchInput = screen.getByPlaceholderText('Search by CC Number...');
    await user.type(searchInput, '5555');

    expect(screen.queryByText(/123.45/)).not.toBeInTheDocument();
    expect(screen.getByText(/50.00/)).toBeInTheDocument();
  });

  test('toggles and applies advanced filters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTransactions,
    });
    render(<TransactionPage />);
    await screen.findByText('2023-10-27 10:00:00');

    // Open filter menu
    const filterButton = screen.getByTestId('filter-button');
    await user.click(filterButton);

    // Apply a filter
    const merchantInput = screen.getByPlaceholderText('Filter by merchant...');
    await user.type(merchantInput, 'Coffee');
    const applyButton = screen.getByRole('button', { name: 'Apply Filters' });
    await user.click(applyButton);

    expect(screen.queryByText(/123.45/)).not.toBeInTheDocument();
    expect(screen.getByText(/50.00/)).toBeInTheDocument();
  });

  test('clears applied filters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTransactions,
    });
    render(<TransactionPage />);
    await screen.findByText('2023-10-27 10:00:00');

    // Open filter menu and apply a filter
    await user.click(screen.getByTestId('filter-button'));
    await user.type(screen.getByPlaceholderText('Filter by merchant...'), 'Coffee');
    await user.click(screen.getByRole('button', { name: 'Apply Filters' }));

    // Ensure filter is working
    expect(screen.queryByText(/123.45/)).not.toBeInTheDocument();

    // Clear filters
    const clearButton = screen.getByRole('button', { name: 'Clear' });
    await user.click(clearButton);

    // Both transactions should be visible again
    expect(await screen.findByText(/123.45/)).toBeInTheDocument();
    expect(screen.getByText(/50.00/)).toBeInTheDocument();
  });

  test('opens and closes the transaction detail modal', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTransactions,
    });
    render(<TransactionPage />);

    const transactionItem = await screen.findByText('2023-10-27 10:00:00');
    await user.click(transactionItem);

    // Modal should be visible with correct details
    expect(await screen.findByText('Transaction Detail')).toBeInTheDocument();
    expect(screen.getByText('Merchant:')).toBeInTheDocument();
    expect(screen.getByText('Tech Store')).toBeInTheDocument();

    // Close the modal
    const closeButton = screen.getByRole('button', { name: 'Close' });
    await user.click(closeButton);
    expect(screen.queryByText('Transaction Detail')).not.toBeInTheDocument();
  });
});
