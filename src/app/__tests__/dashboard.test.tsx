import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import Dashboard from '../dashboard/page'; // Adjust path as needed
import GeneralAlert from '../component/GeneralAlert/GeneralAlert'; // Adjust path

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../component/GeneralAlert/GeneralAlert', () => {
  const originalModule = jest.requireActual('../component/GeneralAlert/GeneralAlert');
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(),
  };
});

const mockGeneralAlert = GeneralAlert as jest.MockedFunction<typeof GeneralAlert>;

// FIX: Moved fillAllFields outside the describe block for clarity and corrected the syntax.
async function fillAllFields() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Transaction Time'), '1/1/19 0:00');
  await user.type(screen.getByLabelText('Card Number'), '1234567890123456');
  await user.type(screen.getByLabelText('Merchant'), 'Test Merchant');
  await user.type(screen.getByLabelText('Category'), 'Test Category');
  await user.type(screen.getByLabelText('Amount'), '100.50');
  await user.type(screen.getByLabelText('First Name'), 'John');
  await user.type(screen.getByLabelText('Last Name'), 'Doe');
  fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'M' } });
  await user.type(screen.getByLabelText('Street'), '123 Test St');
  await user.type(screen.getByLabelText('City'), 'Test City');
  await user.type(screen.getByLabelText('State'), 'TS');
  await user.type(screen.getByLabelText('ZIP'), '12345');
  await user.type(screen.getByLabelText('Latitude'), '40.7128');
  await user.type(screen.getByLabelText('Longitude'), '-74.0060');
  await user.type(screen.getByLabelText('City Population'), '100000');
  await user.type(screen.getByLabelText('Job'), 'Engineer');
  await user.type(screen.getByLabelText('Date of Birth'), '1/1/90');
  await user.type(screen.getByLabelText('Unix Time'), '1546300800');
  await user.type(screen.getByLabelText('Merchant Latitude'), '40.7128');
  await user.type(screen.getByLabelText('Merchant Longitude'), '-74.0060');
}

beforeEach(() => {
  mockGeneralAlert.mockClear();
  mockedAxios.post.mockClear();
  localStorage.clear();
});

global.crypto = {
  randomUUID: () => '00000000-0000-0000-0000-000000000000',
  subtle: {} as SubtleCrypto,
  getRandomValues: (arr: Uint8Array) => arr.fill(0),
} as Crypto;

describe('Dashboard Component', () => {
  const user = userEvent.setup();

  // ... (passing tests are unchanged) ...
  test('renders all form fields and submit button', () => {
    render(<Dashboard />);
    expect(screen.getByLabelText('Transaction Time')).toBeInTheDocument();
    expect(screen.getByLabelText('Card Number')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Detection' })).toBeInTheDocument();
  });

  test('updates form state on input change', () => {
    render(<Dashboard />);
    const transactionTimeInput = screen.getByLabelText('Transaction Time') as HTMLInputElement;
    fireEvent.change(transactionTimeInput, { target: { value: '1/1/19 0:00' } });
    expect(transactionTimeInput.value).toBe('1/1/19 0:00');
  });

  test('shows alert on incomplete form submission', async () => {
    render(<Dashboard />);
    await user.click(screen.getByRole('button', { name: 'Run Detection' }));
    expect(mockGeneralAlert).toHaveBeenCalledWith(expect.objectContaining({
      mode: 2,
      text: 'All fields must be filled',
    }));
  });

  test('handles submission without token', async () => {
    render(<Dashboard />);
    await fillAllFields();
    await user.click(screen.getByRole('button', { name: 'Run Detection' }));

    // FIX: Find the static "Error:" text, then check its parent for the full message.
    const errorElement = await screen.findByText('Error:');
    expect(errorElement.parentElement).toHaveTextContent('Error: Please log in first');

    await waitFor(() => {
        expect(mockGeneralAlert).toHaveBeenCalledWith(expect.objectContaining({
            mode: 2,
            text: 'Please log in first',
        }));
    });
  });

  test('submits form successfully and shows result', async () => {
    localStorage.setItem('token', 'fake-token');
    mockedAxios.post.mockResolvedValueOnce({ data: { is_fraud: 0, score: 0.05 } });
    mockedAxios.post.mockResolvedValueOnce({ data: {} });

    render(<Dashboard />);
    await fillAllFields();
    await user.click(screen.getByRole('button', { name: 'Run Detection' }));

    await screen.findByText('Detection Result');
    expect(screen.getByText('No')).toBeInTheDocument();

    // FIX: Find the static "Score:" text, then check its parent for the full message.
    const scoreElement = await screen.findByText('Score:');
    expect(scoreElement.parentElement).toHaveTextContent('Score: 5.00%');

    expect(mockGeneralAlert).toHaveBeenCalledWith(expect.objectContaining({
      mode: 3,
      text: 'Transaction stored successfully!',
    }));
  });

  test('handles submission error', async () => {
    localStorage.setItem('token', 'fake-token');
    mockedAxios.post.mockRejectedValueOnce({
      response: { data: { detail: 'Detection failed' } },
    });

    render(<Dashboard />);
    await fillAllFields();
    await user.click(screen.getByRole('button', { name: 'Run Detection' }));

    // FIX: Find the static "Error:" text, then check its parent for the full message.
    const errorElement = await screen.findByText('Error:');
    expect(errorElement.parentElement).toHaveTextContent('Error: Detection failed');

    expect(mockGeneralAlert).toHaveBeenCalledWith(expect.objectContaining({
      mode: 2,
      text: 'Detection failed',
    }));
  });
});