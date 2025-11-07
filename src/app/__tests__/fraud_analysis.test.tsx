import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FraudAnalysisPage from '../report/fraud_analysis/page'; // Adjust path as needed
import FraudAnalysisDashboard from '../report/fraud_analysis/fraud_analysis_dashboard'; // Adjust path as needed
const ResizeObserverMock = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
global.ResizeObserver = ResizeObserverMock;

// Mock child components and global fetch
jest.mock('../component/GeneralAlert/GeneralAlert', () => ({
  __esModule: true,
  default: jest.fn(),
  AlertMode: {
    Error: 2,
  },
}));
jest.mock('../component/UI/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h5>{children}</h5>,
}));

const mockFraudTransactions = [
    { id: 1, trans_num: 'abc', cc_num: 1234, merchant: 'Test Merchant 1', category: 'Gas', amt: 100, trans_date_trans_time: '2023-01-01', first: 'John', last: 'Doe', gender: 'M', street: '123 Main St', city: 'Anytown', state: 'CA', zip: 12345, lat: 0, long: 0, city_pop: 1000, job: 'Engineer', dob: '1990-01-01', unix_time: 1672531200, merch_lat: 0, merch_long: 0, is_fraud: 1, fraud_score: 0.9 },
    { id: 2, trans_num: 'def', cc_num: 5678, merchant: 'Test Merchant 2', category: 'Groceries', amt: 200, trans_date_trans_time: '2023-01-02', first: 'Jane', last: 'Doe', gender: 'F', street: '456 Oak St', city: 'Othertown', state: 'NY', zip: 67890, lat: 0, long: 0, city_pop: 2000, job: 'Doctor', dob: '1985-05-05', unix_time: 1672617600, merch_lat: 0, merch_long: 0, is_fraud: 1, fraud_score: 0.8 },
];

// Mock the global fetch function
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'fake-token');
});

describe('FraudAnalysisPage', () => {
  test('renders the main heading', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockFraudTransactions });
    render(<FraudAnalysisPage />);
    expect(screen.getByRole('heading', { name: 'Fraud Analysis' })).toBeInTheDocument();
    // Wait for the dashboard to render to avoid act(...) warnings
    await screen.findByText('Filters');
  });
});

describe('FraudAnalysisDashboard', () => {
  const user = userEvent.setup();

  test('shows error state on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network Error'));
    render(<FraudAnalysisDashboard />);
    
    const mockGeneralAlert = require('../component/GeneralAlert/GeneralAlert').default;
    await waitFor(() => {
      expect(mockGeneralAlert).toHaveBeenCalledWith(expect.objectContaining({
        text: 'Failed to load fraud analysis data. Please try again.',
      }));
    });
  });

  test('fetches and displays analytics data successfully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockFraudTransactions });
    render(<FraudAnalysisDashboard />);

    // Check for summary cards
    const totalCasesCard = await screen.findByText('Total Fraud Cases');
    // FIX: Query within the parent card to avoid ambiguity with other stats that have the value '2'
    expect(within(totalCasesCard.parentElement!.parentElement!).getByText('2')).toBeInTheDocument();
    
    // Check for total amount with more specific selector
    const totalAmountCard = await screen.findByText('Total Amount');
    expect(within(totalAmountCard.parentElement!.parentElement!).getByText('$300')).toBeInTheDocument();
  });

  test('applies and clears filters', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockFraudTransactions });
    render(<FraudAnalysisDashboard />);
    await screen.findByText('Filters');

    // Show filters
    await user.click(screen.getByRole('button', { name: 'Show Filters' }));

    // Apply a filter
    // FIX: Use getByPlaceholderText as a workaround for missing label associations.
    // For a better long-term fix, add htmlFor/id attributes to your labels and inputs.
    await user.type(screen.getByPlaceholderText('Filter by merchant...'), 'Test Merchant 1');
    await user.click(screen.getByRole('button', { name: 'Apply Filters' }));

    // Check if the fetch was called with the new filter
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('merchant=Test+Merchant+1'),
        expect.any(Object)
      );
    });

    // Clear filters
    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));

    // Check if the fetch was called without the filter
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.not.stringContaining('merchant=Test+Merchant+1'),
        expect.any(Object)
      );
    });
  });

  test('switches time series granularity', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockFraudTransactions });
    render(<FraudAnalysisDashboard />);
    await screen.findByText('Fraud Trends Over Time'); // Wait for initial load

    // Click on 'Day' button
    const dayButton = screen.getByRole('button', { name: 'Day' });
    await user.click(dayButton);

    // The component should now display data by day
    expect(screen.getByText('Number of fraud cases by day')).toBeInTheDocument();
  });
});
