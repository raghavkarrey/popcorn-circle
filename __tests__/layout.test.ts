/// <reference types="jest" />
import {
  cardColumns,
  formMaxWidth,
  layoutMode,
  pageTitleSize,
  posterColumns,
  showsSidebar,
} from '../lib/layout';

describe('screen layout', () => {
  it('keeps native at the phone layout at any width', () => {
    expect(layoutMode(390, 'native')).toBe('phone');
    expect(layoutMode(1440, 'native')).toBe('phone');
    expect(posterColumns(1920, 'native')).toBe(1);
    expect(showsSidebar(layoutMode(1920, 'native'))).toBe(false);
  });

  it('uses phone, tablet, and desktop bands on the web', () => {
    expect(layoutMode(390)).toBe('phone');
    expect(layoutMode(599)).toBe('phone');
    expect(layoutMode(600)).toBe('tablet');
    expect(layoutMode(899)).toBe('tablet');
    expect(layoutMode(900)).toBe('desktop');
    expect(layoutMode(1440)).toBe('desktop');
  });

  it('sizes poster grids for laptops and wider screens', () => {
    expect(posterColumns(1024)).toBe(4);
    expect(posterColumns(1440)).toBe(5);
    expect(posterColumns(1680)).toBe(6);
    expect(posterColumns(1920)).toBe(7);
    expect(posterColumns(800)).toBe(1);
  });

  it('uses two card columns and a capped form on desktop only', () => {
    expect(cardColumns(1440)).toBe(2);
    expect(cardColumns(390)).toBe(1);
    expect(formMaxWidth('phone')).toBeUndefined();
    expect(formMaxWidth('desktop')).toBe(520);
    expect(pageTitleSize('phone')).toBeNull();
    expect(pageTitleSize('desktop')?.fontSize).toBeGreaterThan(40);
    expect(showsSidebar('desktop')).toBe(true);
    expect(showsSidebar('tablet')).toBe(false);
  });
});
