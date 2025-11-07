import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// FIX: Corrected the path to point to the component's actual location
import CasesPage from '../cases/page';
import { CaseItem } from '../cases/CaseModal';

// Mock child components and global fetch
jest.mock('../component/GeneralAlert/GeneralAlert', () => ({
  __esModule: true,
  default: jest.fn(),
  AlertMode: {
    ConfirmOrCancel: 1,
    Error: 2,
    Success: 3,
  },
}));

// FIX: Corrected the path to point to the component's actual location
jest.mock('../cases/CaseModal', () => ({
  __esModule: true,
  default: ({ caseData, onClose }: { caseData: CaseItem; onClose: () => void }) => (
    <div data-testid="case-modal">
      <h2>Case #{caseData.case_id}</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock the view components to simplify testing
jest.mock('../component/Types/LoadingView', () => () => <div data-testid="loader">Loading...</div>);
jest.mock('../component/Types/ErrorView', () => () => <div>Something went wrong</div>);


// A reference to the mocked GeneralAlert
const mockGeneralAlert = require('../component/GeneralAlert/GeneralAlert').default;

const mockCases: CaseItem[] = [
  { case_id: 1, txn_ids: ['txn_1'], status: 'open', amt: 123.45, trans_date_trans_time: '2023-10-27 10:00:00', created_at: '2023-10-27T10:00:00Z' },
  { case_id: 2, txn_ids: ['txn_2'], status: 'investigating', amt: 50.0, trans_date_trans_time: '2023-10-26 15:30:00', created_at: '2023-10-26T15:30:00Z' },
  { case_id: 3, txn_ids: ['txn_3'], status: 'closed', amt: 99.99, trans_date_trans_time: '2023-10-25 08:00:00', created_at: '2023-10-25T08:00:00Z' },
  { case_id: 4, txn_ids: ['txn_4'], status: 'open', amt: 250.0, trans_date_trans_time: '2023-10-27 11:00:00', created_at: '2023-10-27T11:00:00Z' },
];

// Mock the global fetch function
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  localStorage.setItem('token', 'fake-token');
});

describe('CasesPage', () => {
  const user = userEvent.setup();



  test('fetches and displays cases successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCases,
    });
    render(<CasesPage />);

    // The component defaults to the 'open' tab
    expect(await screen.findByText(/Case #1/)).toBeInTheDocument();
    expect(screen.getByText(/2023-10-27 10:00:00 — \$123.45/)).toBeInTheDocument();
    expect(screen.getByText(/Case #4/)).toBeInTheDocument();
    expect(screen.queryByText(/Case #2/)).not.toBeInTheDocument(); // Investigating case
  });

  test('switches tabs and filters cases correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCases,
    });
    render(<CasesPage />);

    // Wait for initial data to load
    await screen.findByText(/Case #1/);

    // Click on 'Investigating' tab
    await user.click(screen.getByRole('button', { name: 'Investigating' }));
    expect(await screen.findByText(/Case #2/)).toBeInTheDocument();
    expect(screen.queryByText(/Case #1/)).not.toBeInTheDocument();

    // Click on 'Closed' tab
    await user.click(screen.getByRole('button', { name: 'Closed' }));
    expect(await screen.findByText(/Case #3/)).toBeInTheDocument();
    expect(screen.queryByText(/Case #2/)).not.toBeInTheDocument();
  });

  test('displays "No cases" message for empty tabs', async () => {
    // Return only a closed case
    const singleCase = [mockCases[2]];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => singleCase,
    });
    render(<CasesPage />);

    // 'open' tab should be empty
    expect(await screen.findByText('No cases in this status.')).toBeInTheDocument();
  });

  test('opens and closes the case modal', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCases,
    });
    render(<CasesPage />);

    const caseItem = await screen.findByText(/Case #1/);
    await user.click(caseItem);

    // Modal should be visible
    const modal = await screen.findByTestId('case-modal');
    expect(modal).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Case #1' })).toBeInTheDocument();

    // Click the close button inside the mocked modal
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('case-modal')).not.toBeInTheDocument();
  });

  // NOTE: This test will only pass if you fix the logical OR in your CasesPage.tsx.
  // The condition should be `(c.status === "open" || c.status === "investigating")`
  test('handles "Confirm Fraud" action successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCases,
    });
    render(<CasesPage />);

    // FIX: Wait for the button to appear after data loads
    const confirmButton = (await screen.findAllByRole('button', { name: 'Confirm' }))[0];
    
    // Mock the alert callback to simulate user confirmation
    mockGeneralAlert.mockImplementation((props: { callback: () => void }) => {
      props.callback();
    });

    // Mock the PATCH and subsequent GET requests
    mockFetch
      .mockResolvedValueOnce({ ok: true }) // For the PATCH
      .mockResolvedValueOnce({ ok: true, json: async () => [] }); // For the refresh

    await user.click(confirmButton);

    // Check that the confirmation alert was called
    expect(mockGeneralAlert).toHaveBeenCalledWith(expect.objectContaining({
      text: "Confirm this case as fraudulent and close it?",
    }));

    // Check that the PATCH request was made
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/cases/by-txn/txn_1?status=closed'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    // Check that the success alert was shown after the PATCH
    expect(mockGeneralAlert).toHaveBeenCalledWith(expect.objectContaining({
        text: "Case confirmed as fraudulent and closed.",
    }));
  });

  // NOTE: This test will only pass if you fix the logical OR in your CasesPage.tsx.
  // The condition should be `(c.status === "open" || c.status === "investigating")`
  test('handles "Not Fraud" action successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCases,
    });
    render(<CasesPage />);

    const notFraudButton = (await screen.findAllByRole('button', { name: 'Not fraud' }))[0];

    // Mock the alert callback to simulate user confirmation
    mockGeneralAlert.mockImplementation((props: { callback: () => void }) => {
      props.callback();
    });

    // Mock the POST (rollback) and subsequent GET requests
    mockFetch
      .mockResolvedValueOnce({ ok: true }) // For the POST
      .mockResolvedValueOnce({ ok: true, json: async () => [] }); // For the refresh

    await user.click(notFraudButton);

    // Check that the confirmation alert was called
    expect(mockGeneralAlert).toHaveBeenCalledWith(expect.objectContaining({
      text: "Mark this case as NOT fraudulent and close it?",
    }));

    // Check that the POST request was made
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/cases/rollback/txn_1/?status=closed'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
