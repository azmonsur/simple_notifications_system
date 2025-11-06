import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FailedNotifications from '../components/FailedNotifications';

test('renders failed notifications table', async () => {
  render(<FailedNotifications />);
  expect(screen.getByText(/Failed Notifications/i)).toBeInTheDocument();
});

test('allows retrying a failed notification', async () => {
  render(<FailedNotifications />);
  const retryButton = await screen.findByRole('button', { name: /Retry/i });
  await userEvent.click(retryButton);
  expect(screen.getByText(/Retrying/i)).toBeInTheDocument();
});
