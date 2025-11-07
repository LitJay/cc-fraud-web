import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import StaffUserPage, { StaffUser } from '../staff_user/page'; 

// Mock child components and global fetch
jest.mock('../component/GeneralAlert/GeneralAlert', () => ({
  __esModule: true,
  default: jest.fn(),
  AlertMode: {
    Error: 2,
    Success: 3,
  },
}));
jest.mock('../component/Types/LoadingView', () => () => <div data-testid="loader">Loading...</div>);
jest.mock('../component/Types/ErrorView', () => () => <div>Something went wrong</div>);

const mockGeneralAlert = require('../component/GeneralAlert/GeneralAlert').default;

const mockStaff: StaffUser[] = [
  { id: 1, email: 'admin@test.com', user_name: 'AdminUser', role: "admin" },
  { id: 2, email: 'staff@test.com', user_name: 'StaffUser', role: "staff" },
];

// Mock the global fetch function
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'fake-token');
  localStorage.setItem('role', 'admin'); 
});

describe('StaffUserPage', () => {
  const user = userEvent.setup();



  test('fetches and displays staff users successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStaff,
    });
    render(<StaffUserPage />);
    expect(await screen.findByText('AdminUser')).toBeInTheDocument();
    expect(screen.getByText('staff@test.com')).toBeInTheDocument();
  });

  test('opens add user modal and adds a new user', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [...mockStaff] });
    render(<StaffUserPage />);
    await screen.findByText('AdminUser');

    // Open modal
    await user.click(screen.getByRole('button', { name: '+ Add User' }));
    
    // Find modal by its title and then get its container
    const modalTitle = await screen.findByText('Add New Staff User');
    const modal = modalTitle.closest('.bg-white.rounded-lg');
    expect(modal).not.toBeNull();
    
    // Fill form using queries within the modal
    await user.type(within(modal as HTMLElement).getByLabelText('Email'), 'new@test.com');
    await user.type(within(modal as HTMLElement).getByLabelText('Password'), 'password123');
    await user.type(within(modal as HTMLElement).getByLabelText('Username'), 'NewUser');

    // Mock the add user API call
    const newUser = { id: 3, email: 'new@test.com', user_name: 'NewUser' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => newUser });

    // Submit form
    await user.click(within(modal as HTMLElement).getByRole('button', { name: 'Save' }));
    
    // Check if the new user appears in the table
    expect(await screen.findByText('NewUser')).toBeInTheDocument();
    expect(mockGeneralAlert).toHaveBeenCalledWith(expect.objectContaining({
      text: 'User NewUser added',
    }));
  });

  test('opens edit user modal and updates a user', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [...mockStaff] });
    render(<StaffUserPage />);
    await screen.findByText('AdminUser');

    // Click the first edit button
    const editButtons = await screen.findAllByTitle('Edit');
    await user.click(editButtons[0]);

    // Find modal by its title and then get its container
    const modalTitle = await screen.findByText(/Edit: AdminUser/i);
    const modal = modalTitle.closest('.bg-white.rounded-lg');
    expect(modal).not.toBeNull();

    const usernameInput = within(modal as HTMLElement).getByLabelText('Username');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'UpdatedAdmin');

    // Mock the update API call
    const updatedUser = { id: 1, email: 'admin@test.com', user_name: 'UpdatedAdmin' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => updatedUser });

    // Submit form
    await user.click(within(modal as HTMLElement).getByRole('button', { name: 'Update' }));

    // Check if the user is updated in the table
    expect(await screen.findByText('UpdatedAdmin')).toBeInTheDocument();
    expect(mockGeneralAlert).toHaveBeenCalledWith(expect.objectContaining({
      text: 'User UpdatedAdmin updated',
    }));
  });

  test('opens delete confirmation and deletes a user', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [...mockStaff] });
    render(<StaffUserPage />);
    await screen.findByText('AdminUser');

    // Click the first delete button in the table
    const deleteButtons = await screen.findAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    // Find the confirmation modal by its title
    const modalTitle = await screen.findByText('Confirm Delete');
    const dialog = modalTitle.closest('.bg-white.rounded-lg');
    expect(dialog).not.toBeNull();
    
    // Find the "Delete" button *within* the modal to avoid ambiguity
    const confirmDeleteButton = within(dialog as HTMLElement).getByRole('button', { name: 'Delete' });
    
    // Mock the delete API call
    mockFetch.mockResolvedValueOnce({ ok: true });
    
    await user.click(confirmDeleteButton);

    // Check that the user is removed from the table
    await waitFor(() => {
      expect(screen.queryByText('AdminUser')).not.toBeInTheDocument();
    });
    expect(mockGeneralAlert).toHaveBeenCalledWith(expect.objectContaining({
      text: 'User AdminUser deleted',
    }));
  });
});
