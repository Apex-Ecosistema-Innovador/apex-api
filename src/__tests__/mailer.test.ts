import { waitUntil } from '@vercel/functions';
import { dispatchMail, mailer } from '../lib/mailer';

jest.mock('@vercel/functions', () => ({ waitUntil: jest.fn() }));

const message = { to: 'a@elpoli.edu.co', subject: 'Asunto', text: 'Texto', html: '<p>Texto</p>' };

describe('dispatchMail', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps the delivery alive after the response through waitUntil', async () => {
    dispatchMail(message);

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await (waitUntil as jest.Mock).mock.calls[0][0];
  });

  it('never rejects when the transport fails', async () => {
    jest.spyOn(mailer, 'send').mockRejectedValue(new Error('smtp down'));
    (waitUntil as jest.Mock).mockClear();

    expect(() => dispatchMail(message)).not.toThrow();
    await expect((waitUntil as jest.Mock).mock.calls[0][0]).resolves.toBeUndefined();
  });
});
