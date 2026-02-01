import { render, screen } from '@testing-library/react';
import App from './App';

test('renders QuickPDF header', () => {
  render(<App />);
  const logo = screen.getByAltText(/QuickPDF/i);
  expect(logo).toBeInTheDocument();
});


