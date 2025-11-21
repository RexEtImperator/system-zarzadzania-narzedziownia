import { interpolate } from '../contexts/LanguageContext.jsx';

describe('interpolate', () => {
  test('replaces placeholders with provided params', () => {
    const tpl = 'Łącznie: {count}';
    const res = interpolate(tpl, { count: 5 });
    expect(res).toBe('Łącznie: 5');
  });

  test('returns template when no params and logs debug if placeholders', () => {
    const tpl = 'Witaj, {name}!';
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const res = interpolate(tpl);
    expect(res).toBe(tpl);
    expect(debugSpy).toHaveBeenCalled();
    debugSpy.mockRestore();
  });

  test('warns when params missing required keys', () => {
    const tpl = 'Za {days} dni';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const res = interpolate(tpl, { other: 1 });
    expect(res).toBe('Za {days} dni');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});