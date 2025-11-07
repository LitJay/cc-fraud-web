import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuccessRatePage from '../report/success_rate/page'; // Adjust path as needed
import FraudAnalyticsDashboard from '../report/success_rate/fraud_trend'; // Adjust path as needed

// FIX: Mock ResizeObserver to prevent recharts from crashing in the test environment.
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

const mockFraudData = {
  fraud_count: 10,
  fraud_percentage: 20,
  non_fraud_count: 40,
  non_fraud_percentage: 80,
  total_cases: 50,
};

const mockLineData = [
  { period: '2023-01', fraud_count: 5, non_fraud_count: 20 },
  { period: '2023-02', fraud_count: 3, non_fraud_count: 15 },
];

// Mock the global fetch function
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'fake-token');
});

describe('SuccessRatePage', () => {
  test('renders the main heading', async () => {
    // FIX: Provide mocks for the two initial fetch calls to prevent errors.
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockFraudData })
      .mockResolvedValueOnce({ ok: true, json: async () => mockLineData });
      
    render(<SuccessRatePage />);
    expect(screen.getByRole('heading', { name: 'Model Success Rate' })).toBeInTheDocument();
    // Wait for the dashboard to render to avoid act(...) warnings
    await screen.findByText('Fraud Distribution');
  });
});

describe('FraudAnalyticsDashboard', () => {
  const user = userEvent.setup();

  test('shows loading state initially', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<FraudAnalyticsDashboard />);
    // Since you have a custom loading skeleton, we check that the main content is NOT yet visible.
    expect(screen.queryByText('Fraud Distribution')).not.toBeInTheDocument();
  });

  test('shows error state on fetch failure', async () => {
    // FIX: Mock the first fetch to fail and the second to succeed to prevent an unhandled promise rejection.
    mockFetch
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({ ok: true, json: async () => mockLineData });

    render(<FraudAnalyticsDashboard />);
    
    const mockGeneralAlert = require('../component/GeneralAlert/GeneralAlert').default;
    await waitFor(() => {
      expect(mockGeneralAlert).toHaveBeenCalledWith(expect.objectContaining({
        text: 'Failed to load fraud analytics data. Please try again.',
      }));
    });
  });

  test('fetches and displays analytics data successfully', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockFraudData })
      .mockResolvedValueOnce({ ok: true, json: async () => mockLineData });
      
    render(<FraudAnalyticsDashboard />);

    // Check for pie chart and stats
    expect(await screen.findByText('Fraud Distribution')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument(); // Total cases
    expect(screen.getByText('20.0%')).toBeInTheDocument(); // Fraud percentage
    expect(screen.getByText('80.0%')).toBeInTheDocument(); // Non-fraud percentage
  });

  test('switches time series granularity', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockFraudData })
      .mockResolvedValueOnce({ ok: true, json: async () => mockLineData }); // Initial month data
      
    render(<FraudAnalyticsDashboard />);
    await screen.findByText('Fraud Distribution'); // Wait for initial load

    // Mock fetch for the 'day' granularity
    const dailyData = [{ period: '2023-01-01', fraud_count: 1, non_fraud_count: 2 }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => dailyData });

    // Click on 'Day' button
    const dayButton = screen.getByRole('button', { name: 'Day' });
    await user.click(dayButton);

    // Check if the fetch was called with the new granularity
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('granularity=day'),
        expect.any(Object)
      );
    });
  });
});
