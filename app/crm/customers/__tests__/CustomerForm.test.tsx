import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CustomerForm } from '../_components/CustomerForm'

describe('CustomerForm', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows shared required-name validation', async () => {
    const user = userEvent.setup()
    render(
      <CustomerForm
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        submitLabel="Save"
        submittingLabel="Saving..."
      />
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Name is required.')).toBeTruthy()
  })

  it('submits canonical address fields', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <CustomerForm
        initialValues={{
          name: ' Taylor Jones ',
          phone: ' 812-555-0100 ',
          email: ' taylor@example.com ',
          street: ' 123 Main St ',
          city: ' Newburgh ',
          state: ' in ',
          zip: ' 47630 ',
        }}
        onSubmit={onSubmit}
        submitLabel="Save"
        submittingLabel="Saving..."
      />
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Taylor Jones',
      phone: '812-555-0100',
      email: 'taylor@example.com',
      street: '123 Main St',
      city: 'Newburgh',
      state: 'in',
      zip: '47630',
    })
  })

  it('reseeds values when initial values change', async () => {
    const { rerender } = render(
      <CustomerForm
        initialValues={{ name: 'Taylor Jones' }}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        submitLabel="Save"
        submittingLabel="Saving..."
      />
    )

    expect(screen.getByDisplayValue('Taylor Jones')).toBeTruthy()

    rerender(
      <CustomerForm
        initialValues={{ name: 'Jordan Lee' }}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        submitLabel="Save"
        submittingLabel="Saving..."
      />
    )

    expect(screen.getByDisplayValue('Jordan Lee')).toBeTruthy()
  })

  it('shows legacy address cleanup guidance and requires canonical address fields', async () => {
    const user = userEvent.setup()
    render(
      <CustomerForm
        initialValues={{ name: 'Taylor Jones' }}
        legacyAddressCleanup={{
          needsCleanup: true,
          warning: 'This customer has an address in an older format.',
          legacyAddress: '123 Main St Newburgh IN',
        }}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        submitLabel="Save"
        submittingLabel="Saving..."
      />
    )

    expect(screen.getByText('Legacy address needs cleanup')).toBeTruthy()
    expect(screen.getByText(/123 Main St Newburgh IN/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      screen.getByText('Enter street, city, state, and ZIP to replace the legacy address.')
    ).toBeTruthy()
  })

  it('surfaces submit errors and invokes cancel when provided', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <CustomerForm
        initialValues={{ name: 'Taylor Jones' }}
        onSubmit={vi.fn().mockRejectedValue(new Error('Save failed'))}
        submitLabel="Save"
        submittingLabel="Saving..."
        onCancel={onCancel}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Save failed')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows duplicate conflicts returned by submit handlers', async () => {
    const user = userEvent.setup()
    render(
      <CustomerForm
        initialValues={{ name: 'Taylor Jones', email: 'taylor@example.com' }}
        onSubmit={vi
          .fn()
          .mockRejectedValue(new Error('A customer with the same name, email, or phone already exists.'))}
        submitLabel="Save"
        submittingLabel="Saving..."
      />
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('A customer with the same name, email, or phone already exists.')
    ).toBeTruthy()
  })
})
