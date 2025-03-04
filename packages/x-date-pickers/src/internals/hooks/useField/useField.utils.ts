import {
  AvailableAdjustKeyCode,
  FieldSectionsValueBoundaries,
  SectionNeighbors,
  SectionOrdering,
  FieldSectionWithoutPosition,
  FieldSectionValueBoundaries,
} from './useField.types';
import {
  FieldSectionType,
  FieldValueType,
  FieldSection,
  MuiPickersAdapter,
  FieldSectionContentType,
  PickersTimezone,
} from '../../../models';
import { PickersLocaleText } from '../../../locales/utils/pickersLocaleTextApi';
import { getMonthsInYear } from '../../utils/date-utils';

export const getDateSectionConfigFromFormatToken = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  formatToken: string,
): Pick<FieldSection, 'type' | 'contentType'> & { maxLength: number | undefined } => {
  const config = utils.formatTokenMap[formatToken];

  if (config == null) {
    throw new Error(
      [
        `MUI X: The token "${formatToken}" is not supported by the Date and Time Pickers.`,
        'Please try using another token or open an issue on https://github.com/mui/mui-x/issues/new/choose if you think it should be supported.',
      ].join('\n'),
    );
  }

  if (typeof config === 'string') {
    return {
      type: config,
      contentType: config === 'meridiem' ? 'letter' : 'digit',
      maxLength: undefined,
    };
  }

  return {
    type: config.sectionType,
    contentType: config.contentType,
    maxLength: config.maxLength,
  };
};

const getDeltaFromKeyCode = (keyCode: Omit<AvailableAdjustKeyCode, 'Home' | 'End'>) => {
  switch (keyCode) {
    case 'ArrowUp':
      return 1;
    case 'ArrowDown':
      return -1;
    case 'PageUp':
      return 5;
    case 'PageDown':
      return -5;
    default:
      return 0;
  }
};

export const getDaysInWeekStr = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  timezone: PickersTimezone,
  format: string,
) => {
  const elements: TDate[] = [];

  const now = utils.date(undefined, timezone);
  const startDate = utils.startOfWeek(now);
  const endDate = utils.endOfWeek(now);

  let current = startDate;
  while (utils.isBefore(current, endDate)) {
    elements.push(current);
    current = utils.addDays(current, 1);
  }

  return elements.map((weekDay) => utils.formatByString(weekDay, format));
};

export const getLetterEditingOptions = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  timezone: PickersTimezone,
  sectionType: FieldSectionType,
  format: string,
) => {
  switch (sectionType) {
    case 'month': {
      return getMonthsInYear(utils, utils.date(undefined, timezone)).map((month) =>
        utils.formatByString(month, format!),
      );
    }

    case 'weekDay': {
      return getDaysInWeekStr(utils, timezone, format);
    }

    case 'meridiem': {
      const now = utils.date(undefined, timezone);
      return [utils.startOfDay(now), utils.endOfDay(now)].map((date) =>
        utils.formatByString(date, format),
      );
    }

    default: {
      return [];
    }
  }
};

export const cleanLeadingZeros = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  valueStr: string,
  size: number,
) => {
  let cleanValueStr = valueStr;

  // Remove the leading zeros
  cleanValueStr = Number(cleanValueStr).toString();

  // Add enough leading zeros to fill the section
  while (cleanValueStr.length < size) {
    cleanValueStr = `0${cleanValueStr}`;
  }

  return cleanValueStr;
};

export const cleanDigitSectionValue = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  timezone: PickersTimezone,
  value: number,
  sectionBoundaries: FieldSectionValueBoundaries<TDate, any>,
  section: Pick<
    FieldSection,
    | 'format'
    | 'type'
    | 'contentType'
    | 'hasLeadingZerosInFormat'
    | 'hasLeadingZerosInInput'
    | 'maxLength'
  >,
) => {
  if (process.env.NODE_ENV !== 'production') {
    if (section.type !== 'day' && section.contentType === 'digit-with-letter') {
      throw new Error(
        [
          `MUI X: The token "${section.format}" is a digit format with letter in it.'
             This type of format is only supported for 'day' sections`,
        ].join('\n'),
      );
    }
  }

  if (section.type === 'day' && section.contentType === 'digit-with-letter') {
    const date = utils.setDate(
      (sectionBoundaries as FieldSectionValueBoundaries<TDate, 'day'>).longestMonth,
      value,
    );
    return utils.formatByString(date, section.format);
  }

  // queryValue without leading `0` (`01` => `1`)
  const valueStr = value.toString();

  if (section.hasLeadingZerosInInput) {
    return cleanLeadingZeros(utils, valueStr, section.maxLength!);
  }

  return valueStr;
};

export const adjustSectionValue = <TDate, TSection extends FieldSection>(
  utils: MuiPickersAdapter<TDate>,
  timezone: PickersTimezone,
  section: TSection,
  keyCode: AvailableAdjustKeyCode,
  sectionsValueBoundaries: FieldSectionsValueBoundaries<TDate>,
  activeDate: TDate | null,
  stepsAttributes?: { minutesStep?: number },
): string => {
  const delta = getDeltaFromKeyCode(keyCode);
  const isStart = keyCode === 'Home';
  const isEnd = keyCode === 'End';

  const shouldSetAbsolute = section.value === '' || isStart || isEnd;

  const adjustDigitSection = () => {
    const sectionBoundaries = sectionsValueBoundaries[section.type]({
      currentDate: activeDate,
      format: section.format,
      contentType: section.contentType,
    });

    const getCleanValue = (value: number) =>
      cleanDigitSectionValue(utils, timezone, value, sectionBoundaries, section);

    const step =
      section.type === 'minutes' && stepsAttributes?.minutesStep ? stepsAttributes.minutesStep : 1;

    const currentSectionValue = parseInt(section.value, 10);
    let newSectionValueNumber = currentSectionValue + delta * step;

    if (shouldSetAbsolute) {
      if (section.type === 'year' && !isEnd && !isStart) {
        return utils.formatByString(utils.date(undefined, timezone), section.format);
      }

      if (delta > 0 || isStart) {
        newSectionValueNumber = sectionBoundaries.minimum;
      } else {
        newSectionValueNumber = sectionBoundaries.maximum;
      }
    }

    if (newSectionValueNumber % step !== 0) {
      if (delta < 0 || isStart) {
        newSectionValueNumber += step - ((step + newSectionValueNumber) % step); // for JS -3 % 5 = -3 (should be 2)
      }
      if (delta > 0 || isEnd) {
        newSectionValueNumber -= newSectionValueNumber % step;
      }
    }

    if (newSectionValueNumber > sectionBoundaries.maximum) {
      return getCleanValue(
        sectionBoundaries.minimum +
          ((newSectionValueNumber - sectionBoundaries.maximum - 1) %
            (sectionBoundaries.maximum - sectionBoundaries.minimum + 1)),
      );
    }

    if (newSectionValueNumber < sectionBoundaries.minimum) {
      return getCleanValue(
        sectionBoundaries.maximum -
          ((sectionBoundaries.minimum - newSectionValueNumber - 1) %
            (sectionBoundaries.maximum - sectionBoundaries.minimum + 1)),
      );
    }

    return getCleanValue(newSectionValueNumber);
  };

  const adjustLetterSection = () => {
    const options = getLetterEditingOptions(utils, timezone, section.type, section.format);
    if (options.length === 0) {
      return section.value;
    }

    if (shouldSetAbsolute) {
      if (delta > 0 || isStart) {
        return options[0];
      }

      return options[options.length - 1];
    }

    const currentOptionIndex = options.indexOf(section.value);
    const newOptionIndex = (currentOptionIndex + options.length + delta) % options.length;

    return options[newOptionIndex];
  };

  if (section.contentType === 'digit' || section.contentType === 'digit-with-letter') {
    return adjustDigitSection();
  }

  return adjustLetterSection();
};

export const getSectionVisibleValue = (
  section: FieldSectionWithoutPosition,
  target: 'input-rtl' | 'input-ltr' | 'non-input',
) => {
  let value = section.value || section.placeholder;

  const hasLeadingZeros =
    target === 'non-input' ? section.hasLeadingZerosInFormat : section.hasLeadingZerosInInput;

  if (
    target === 'non-input' &&
    section.hasLeadingZerosInInput &&
    !section.hasLeadingZerosInFormat
  ) {
    value = Number(value).toString();
  }

  // In the input, we add an empty character at the end of each section without leading zeros.
  // This makes sure that `onChange` will always be fired.
  // Otherwise, when your input value equals `1/dd/yyyy` (format `M/DD/YYYY` on DayJs),
  // If you press `1`, on the first section, the new value is also `1/dd/yyyy`,
  // So the browser will not fire the input `onChange`.
  const shouldAddInvisibleSpace =
    ['input-rtl', 'input-ltr'].includes(target) &&
    section.contentType === 'digit' &&
    !hasLeadingZeros &&
    value.length === 1;

  if (shouldAddInvisibleSpace) {
    value = `${value}\u200e`;
  }

  if (target === 'input-rtl') {
    value = `\u2068${value}\u2069`;
  }

  return value;
};

export const cleanString = (dirtyString: string) =>
  dirtyString.replace(/[\u2066\u2067\u2068\u2069]/g, '');

export const addPositionPropertiesToSections = <TSection extends FieldSection>(
  sections: FieldSectionWithoutPosition<TSection>[],
  isRTL: boolean,
): TSection[] => {
  let position = 0;
  let positionInInput = isRTL ? 1 : 0;
  const newSections: TSection[] = [];

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const renderedValue = getSectionVisibleValue(section, isRTL ? 'input-rtl' : 'input-ltr');
    const sectionStr = `${section.startSeparator}${renderedValue}${section.endSeparator}`;

    const sectionLength = cleanString(sectionStr).length;
    const sectionLengthInInput = sectionStr.length;

    // The ...InInput values consider the unicode characters but do include them in their indexes
    const cleanedValue = cleanString(renderedValue);
    const startInInput =
      positionInInput +
      (cleanedValue === '' ? 0 : renderedValue.indexOf(cleanedValue[0])) +
      section.startSeparator.length;
    const endInInput = startInInput + cleanedValue.length;

    newSections.push({
      ...section,
      start: position,
      end: position + sectionLength,
      startInInput,
      endInInput,
    } as TSection);
    position += sectionLength;
    // Move position to the end of string associated to the current section
    positionInInput += sectionLengthInInput;
  }

  return newSections;
};

const getSectionPlaceholder = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  timezone: PickersTimezone,
  localeText: PickersLocaleText<TDate>,
  sectionConfig: Pick<FieldSection, 'type' | 'contentType'>,
  sectionFormat: string,
) => {
  switch (sectionConfig.type) {
    case 'year': {
      return localeText.fieldYearPlaceholder({
        digitAmount: utils.formatByString(utils.date(undefined, timezone), sectionFormat).length,
        format: sectionFormat,
      });
    }

    case 'month': {
      return localeText.fieldMonthPlaceholder({
        contentType: sectionConfig.contentType,
        format: sectionFormat,
      });
    }

    case 'day': {
      return localeText.fieldDayPlaceholder({ format: sectionFormat });
    }

    case 'weekDay': {
      return localeText.fieldWeekDayPlaceholder({
        contentType: sectionConfig.contentType,
        format: sectionFormat,
      });
    }

    case 'hours': {
      return localeText.fieldHoursPlaceholder({ format: sectionFormat });
    }

    case 'minutes': {
      return localeText.fieldMinutesPlaceholder({ format: sectionFormat });
    }

    case 'seconds': {
      return localeText.fieldSecondsPlaceholder({ format: sectionFormat });
    }

    case 'meridiem': {
      return localeText.fieldMeridiemPlaceholder({ format: sectionFormat });
    }

    default: {
      return sectionFormat;
    }
  }
};

export const changeSectionValueFormat = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  valueStr: string,
  currentFormat: string,
  newFormat: string,
) => {
  if (process.env.NODE_ENV !== 'production') {
    if (getDateSectionConfigFromFormatToken(utils, currentFormat).type === 'weekDay') {
      throw new Error("changeSectionValueFormat doesn't support week day formats");
    }
  }

  return utils.formatByString(utils.parse(valueStr, currentFormat)!, newFormat);
};

const isFourDigitYearFormat = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  timezone: PickersTimezone,
  format: string,
) => utils.formatByString(utils.date(undefined, timezone), format).length === 4;

export const doesSectionFormatHaveLeadingZeros = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  timezone: PickersTimezone,
  contentType: FieldSectionContentType,
  sectionType: FieldSectionType,
  format: string,
) => {
  if (contentType !== 'digit') {
    return false;
  }

  const now = utils.date(undefined, timezone);

  switch (sectionType) {
    // We can't use `changeSectionValueFormat`, because  `utils.parse('1', 'YYYY')` returns `1971` instead of `1`.
    case 'year': {
      if (isFourDigitYearFormat(utils, timezone, format)) {
        const formatted0001 = utils.formatByString(utils.setYear(now, 1), format);
        return formatted0001 === '0001';
      }

      const formatted2001 = utils.formatByString(utils.setYear(now, 2001), format);
      return formatted2001 === '01';
    }

    case 'month': {
      return utils.formatByString(utils.startOfYear(now), format).length > 1;
    }

    case 'day': {
      return utils.formatByString(utils.startOfMonth(now), format).length > 1;
    }

    case 'weekDay': {
      return utils.formatByString(utils.startOfWeek(now), format).length > 1;
    }

    case 'hours': {
      return utils.formatByString(utils.setHours(now, 1), format).length > 1;
    }

    case 'minutes': {
      return utils.formatByString(utils.setMinutes(now, 1), format).length > 1;
    }

    case 'seconds': {
      return utils.formatByString(utils.setSeconds(now, 1), format).length > 1;
    }

    default: {
      throw new Error('Invalid section type');
    }
  }
};

const getEscapedPartsFromFormat = <TDate>(utils: MuiPickersAdapter<TDate>, format: string) => {
  const escapedParts: { start: number; end: number }[] = [];
  const { start: startChar, end: endChar } = utils.escapedCharacters;
  const regExp = new RegExp(`(\\${startChar}[^\\${endChar}]*\\${endChar})+`, 'g');

  let match: RegExpExecArray | null = null;
  // eslint-disable-next-line no-cond-assign
  while ((match = regExp.exec(format))) {
    escapedParts.push({ start: match.index, end: regExp.lastIndex - 1 });
  }

  return escapedParts;
};

export const splitFormatIntoSections = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  timezone: PickersTimezone,
  localeText: PickersLocaleText<TDate>,
  format: string,
  date: TDate | null,
  formatDensity: 'dense' | 'spacious',
  shouldRespectLeadingZeros: boolean,
  isRTL: boolean,
) => {
  let startSeparator: string = '';
  const sections: FieldSectionWithoutPosition[] = [];
  const now = utils.date()!;

  const commitToken = (token: string) => {
    if (token === '') {
      return null;
    }

    const sectionConfig = getDateSectionConfigFromFormatToken(utils, token);

    const hasLeadingZerosInFormat = doesSectionFormatHaveLeadingZeros(
      utils,
      timezone,
      sectionConfig.contentType,
      sectionConfig.type,
      token,
    );

    const hasLeadingZerosInInput = shouldRespectLeadingZeros
      ? hasLeadingZerosInFormat
      : sectionConfig.contentType === 'digit';

    const isValidDate = date != null && utils.isValid(date);
    let sectionValue = isValidDate ? utils.formatByString(date, token) : '';
    let maxLength: number | null = null;

    if (hasLeadingZerosInInput) {
      if (hasLeadingZerosInFormat) {
        maxLength =
          sectionValue === '' ? utils.formatByString(now, token).length : sectionValue.length;
      } else {
        if (sectionConfig.maxLength == null) {
          throw new Error(
            `MUI X: The token ${token} should have a 'maxDigitNumber' property on it's adapter`,
          );
        }

        maxLength = sectionConfig.maxLength;

        if (isValidDate) {
          sectionValue = cleanLeadingZeros(utils, sectionValue, maxLength);
        }
      }
    }

    sections.push({
      ...sectionConfig,
      format: token,
      maxLength,
      value: sectionValue,
      placeholder: getSectionPlaceholder(utils, timezone, localeText, sectionConfig, token),
      hasLeadingZerosInFormat,
      hasLeadingZerosInInput,
      startSeparator: sections.length === 0 ? startSeparator : '',
      endSeparator: '',
      modified: false,
    });

    return null;
  };

  // Expand the provided format
  let formatExpansionOverflow = 10;
  let prevFormat = format;
  let nextFormat = utils.expandFormat(format);
  while (nextFormat !== prevFormat) {
    prevFormat = nextFormat;
    nextFormat = utils.expandFormat(prevFormat);
    formatExpansionOverflow -= 1;
    if (formatExpansionOverflow < 0) {
      throw new Error(
        'MUI X: The format expansion seems to be  enter in an infinite loop. Please open an issue with the format passed to the picker component.',
      );
    }
  }
  const expandedFormat = nextFormat;

  // Get start/end indexes of escaped sections
  const escapedParts = getEscapedPartsFromFormat(utils, expandedFormat);

  // This RegExp test if the beginning of a string correspond to a supported token
  const isTokenStartRegExp = new RegExp(
    `^(${Object.keys(utils.formatTokenMap)
      .sort((a, b) => b.length - a.length) // Sort to put longest word first
      .join('|')})`,
    'g', // used to get access to lastIndex state
  );

  let currentTokenValue = '';

  for (let i = 0; i < expandedFormat.length; i += 1) {
    const escapedPartOfCurrentChar = escapedParts.find(
      (escapeIndex) => escapeIndex.start <= i && escapeIndex.end >= i,
    );

    const char = expandedFormat[i];
    const isEscapedChar = escapedPartOfCurrentChar != null;
    const potentialToken = `${currentTokenValue}${expandedFormat.slice(i)}`;
    const regExpMatch = isTokenStartRegExp.test(potentialToken);

    if (!isEscapedChar && char.match(/([A-Za-z]+)/) && regExpMatch) {
      currentTokenValue = potentialToken.slice(0, isTokenStartRegExp.lastIndex);
      i += isTokenStartRegExp.lastIndex - 1;
    } else {
      // If we are on the opening or closing character of an escaped part of the format,
      // Then we ignore this character.
      const isEscapeBoundary =
        (isEscapedChar && escapedPartOfCurrentChar?.start === i) ||
        escapedPartOfCurrentChar?.end === i;

      if (!isEscapeBoundary) {
        commitToken(currentTokenValue);

        currentTokenValue = '';
        if (sections.length === 0) {
          startSeparator += char;
        } else {
          sections[sections.length - 1].endSeparator += char;
        }
      }
    }
  }

  commitToken(currentTokenValue);

  if (sections.length === 0 && startSeparator.length > 0) {
    sections.push({
      type: 'empty',
      contentType: 'letter',
      maxLength: null,
      format: '',
      value: '',
      placeholder: '',
      hasLeadingZerosInFormat: false,
      hasLeadingZerosInInput: false,
      startSeparator,
      endSeparator: '',
      modified: false,
    });
  }

  return sections.map((section) => {
    const cleanSeparator = (separator: string) => {
      let cleanedSeparator = separator;
      if (isRTL && cleanedSeparator !== null && cleanedSeparator.includes(' ')) {
        cleanedSeparator = `\u2069${cleanedSeparator}\u2066`;
      }

      if (formatDensity === 'spacious' && ['/', '.', '-'].includes(cleanedSeparator)) {
        cleanedSeparator = ` ${cleanedSeparator} `;
      }

      return cleanedSeparator;
    };

    section.startSeparator = cleanSeparator(section.startSeparator);
    section.endSeparator = cleanSeparator(section.endSeparator);

    return section;
  });
};

/**
 * Some date libraries like `dayjs` don't support parsing from date with escaped characters.
 * To make sure that the parsing works, we are building a format and a date without any separator.
 */
export const getDateFromDateSections = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  sections: FieldSection[],
) => {
  // If we have both a day and a weekDay section,
  // Then we skip the weekDay in the parsing because libraries like dayjs can't parse complicated formats containing a weekDay.
  // dayjs(dayjs().format('dddd MMMM D YYYY'), 'dddd MMMM D YYYY')) // returns `Invalid Date` even if the format is valid.
  const shouldSkipWeekDays = sections.some((section) => section.type === 'day');

  const sectionFormats: string[] = [];
  const sectionValues: string[] = [];
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];

    const shouldSkip = shouldSkipWeekDays && section.type === 'weekDay';
    if (!shouldSkip) {
      sectionFormats.push(section.format);
      sectionValues.push(getSectionVisibleValue(section, 'non-input'));
    }
  }

  const formatWithoutSeparator = sectionFormats.join(' ');
  const dateWithoutSeparatorStr = sectionValues.join(' ');

  return utils.parse(dateWithoutSeparatorStr, formatWithoutSeparator)!;
};

export const createDateStrForInputFromSections = (sections: FieldSection[], isRTL: boolean) => {
  const formattedSections = sections.map((section) => {
    const dateValue = getSectionVisibleValue(section, isRTL ? 'input-rtl' : 'input-ltr');

    return `${section.startSeparator}${dateValue}${section.endSeparator}`;
  });

  const dateStr = formattedSections.join('');

  if (!isRTL) {
    return dateStr;
  }

  // \u2066: start left-to-right isolation
  // \u2067: start right-to-left isolation
  // \u2068: start first strong character isolation
  // \u2069: pop isolation
  // wrap into an isolated group such that separators can split the string in smaller ones by adding \u2069\u2068
  return `\u2066${dateStr}\u2069`;
};

export const getSectionsBoundaries = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  timezone: PickersTimezone,
): FieldSectionsValueBoundaries<TDate> => {
  const today = utils.date(undefined, timezone);
  const endOfYear = utils.endOfYear(today);
  const endOfDay = utils.endOfDay(today);

  const { maxDaysInMonth, longestMonth } = getMonthsInYear(utils, today).reduce(
    (acc, month) => {
      const daysInMonth = utils.getDaysInMonth(month);

      if (daysInMonth > acc.maxDaysInMonth) {
        return { maxDaysInMonth: daysInMonth, longestMonth: month };
      }

      return acc;
    },
    { maxDaysInMonth: 0, longestMonth: null as TDate | null },
  );

  return {
    year: ({ format }) => ({
      minimum: 0,
      maximum: isFourDigitYearFormat(utils, timezone, format) ? 9999 : 99,
    }),
    month: () => ({
      minimum: 1,
      // Assumption: All years have the same amount of months
      maximum: utils.getMonth(endOfYear) + 1,
    }),
    day: ({ currentDate }) => ({
      minimum: 1,
      maximum:
        currentDate != null && utils.isValid(currentDate)
          ? utils.getDaysInMonth(currentDate)
          : maxDaysInMonth,
      longestMonth: longestMonth!,
    }),
    weekDay: ({ format, contentType }) => {
      if (contentType === 'digit') {
        const daysInWeek = getDaysInWeekStr(utils, timezone, format).map(Number);
        return {
          minimum: Math.min(...daysInWeek),
          maximum: Math.max(...daysInWeek),
        };
      }

      return {
        minimum: 1,
        maximum: 7,
      };
    },
    hours: ({ format }) => {
      const lastHourInDay = utils.getHours(endOfDay);
      const hasMeridiem =
        utils.formatByString(utils.endOfDay(today), format) !== lastHourInDay.toString();

      if (hasMeridiem) {
        return {
          minimum: 1,
          maximum: Number(utils.formatByString(utils.startOfDay(today), format)),
        };
      }

      return {
        minimum: 0,
        maximum: lastHourInDay,
      };
    },
    minutes: () => ({
      minimum: 0,
      // Assumption: All years have the same amount of minutes
      maximum: utils.getMinutes(endOfDay),
    }),
    seconds: () => ({
      minimum: 0,
      // Assumption: All years have the same amount of seconds
      maximum: utils.getSeconds(endOfDay),
    }),
    meridiem: () => ({
      minimum: 0,
      maximum: 0,
    }),
    empty: () => ({
      minimum: 0,
      maximum: 0,
    }),
  };
};

let warnedOnceInvalidSection = false;

export const validateSections = <TSection extends FieldSection>(
  sections: TSection[],
  valueType: FieldValueType,
) => {
  if (process.env.NODE_ENV !== 'production') {
    if (!warnedOnceInvalidSection) {
      const supportedSections: FieldSectionType[] = ['empty'];
      if (['date', 'date-time'].includes(valueType)) {
        supportedSections.push('weekDay', 'day', 'month', 'year');
      }
      if (['time', 'date-time'].includes(valueType)) {
        supportedSections.push('hours', 'minutes', 'seconds', 'meridiem');
      }

      const invalidSection = sections.find((section) => !supportedSections.includes(section.type));

      if (invalidSection) {
        console.warn(
          `MUI X: The field component you are using is not compatible with the "${invalidSection.type}" date section.`,
          `The supported date sections are ["${supportedSections.join('", "')}"]\`.`,
        );
        warnedOnceInvalidSection = true;
      }
    }
  }
};

const transferDateSectionValue = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  timezone: PickersTimezone,
  section: FieldSectionWithoutPosition,
  dateToTransferFrom: TDate,
  dateToTransferTo: TDate,
) => {
  switch (section.type) {
    case 'year': {
      return utils.setYear(dateToTransferTo, utils.getYear(dateToTransferFrom));
    }

    case 'month': {
      return utils.setMonth(dateToTransferTo, utils.getMonth(dateToTransferFrom));
    }

    case 'weekDay': {
      const formattedDaysInWeek = getDaysInWeekStr(utils, timezone, section.format);
      const dayInWeekStrOfActiveDate = utils.formatByString(dateToTransferFrom, section.format);
      const dayInWeekOfActiveDate = formattedDaysInWeek.indexOf(dayInWeekStrOfActiveDate);
      const dayInWeekOfNewSectionValue = formattedDaysInWeek.indexOf(section.value);
      const diff = dayInWeekOfNewSectionValue - dayInWeekOfActiveDate;

      return utils.addDays(dateToTransferFrom, diff);
    }

    case 'day': {
      return utils.setDate(dateToTransferTo, utils.getDate(dateToTransferFrom));
    }

    case 'meridiem': {
      const isAM = utils.getHours(dateToTransferFrom) < 12;
      const mergedDateHours = utils.getHours(dateToTransferTo);

      if (isAM && mergedDateHours >= 12) {
        return utils.addHours(dateToTransferTo, -12);
      }

      if (!isAM && mergedDateHours < 12) {
        return utils.addHours(dateToTransferTo, 12);
      }

      return dateToTransferTo;
    }

    case 'hours': {
      return utils.setHours(dateToTransferTo, utils.getHours(dateToTransferFrom));
    }

    case 'minutes': {
      return utils.setMinutes(dateToTransferTo, utils.getMinutes(dateToTransferFrom));
    }

    case 'seconds': {
      return utils.setSeconds(dateToTransferTo, utils.getSeconds(dateToTransferFrom));
    }

    default: {
      return dateToTransferTo;
    }
  }
};

const reliableSectionModificationOrder: Record<FieldSectionType, number> = {
  year: 1,
  month: 2,
  day: 3,
  weekDay: 4,
  hours: 5,
  minutes: 6,
  seconds: 7,
  meridiem: 8,
  empty: 9,
};

export const mergeDateIntoReferenceDate = <TDate>(
  utils: MuiPickersAdapter<TDate>,
  timezone: PickersTimezone,
  dateToTransferFrom: TDate,
  sections: FieldSectionWithoutPosition[],
  referenceDate: TDate,
  shouldLimitToEditedSections: boolean,
) =>
  // cloning sections before sort to avoid mutating it
  [...sections]
    .sort(
      (a, b) => reliableSectionModificationOrder[a.type] - reliableSectionModificationOrder[b.type],
    )
    .reduce((mergedDate, section) => {
      if (!shouldLimitToEditedSections || section.modified) {
        return transferDateSectionValue(utils, timezone, section, dateToTransferFrom, mergedDate);
      }

      return mergedDate;
    }, referenceDate);

export const isAndroid = () => navigator.userAgent.toLowerCase().indexOf('android') > -1;

export const getSectionOrder = (
  sections: FieldSectionWithoutPosition[],
  isRTL: boolean,
): SectionOrdering => {
  const neighbors: SectionNeighbors = {};
  if (!isRTL) {
    sections.forEach((_, index) => {
      const leftIndex = index === 0 ? null : index - 1;
      const rightIndex = index === sections.length - 1 ? null : index + 1;
      neighbors[index] = { leftIndex, rightIndex };
    });
    return { neighbors, startIndex: 0, endIndex: sections.length - 1 };
  }

  type PositionMapping = { [from: number]: number };
  const rtl2ltr: PositionMapping = {};
  const ltr2rtl: PositionMapping = {};

  let groupedSectionsStart = 0;
  let groupedSectionsEnd = 0;
  let RTLIndex = sections.length - 1;

  while (RTLIndex >= 0) {
    groupedSectionsEnd = sections.findIndex(
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      (section, index) =>
        index >= groupedSectionsStart &&
        section.endSeparator?.includes(' ') &&
        // Special case where the spaces were not there in the initial input
        section.endSeparator !== ' / ',
    );
    if (groupedSectionsEnd === -1) {
      groupedSectionsEnd = sections.length - 1;
    }

    for (let i = groupedSectionsEnd; i >= groupedSectionsStart; i -= 1) {
      ltr2rtl[i] = RTLIndex;
      rtl2ltr[RTLIndex] = i;
      RTLIndex -= 1;
    }
    groupedSectionsStart = groupedSectionsEnd + 1;
  }

  sections.forEach((_, index) => {
    const rtlIndex = ltr2rtl[index];
    const leftIndex = rtlIndex === 0 ? null : rtl2ltr[rtlIndex - 1];
    const rightIndex = rtlIndex === sections.length - 1 ? null : rtl2ltr[rtlIndex + 1];

    neighbors[index] = { leftIndex, rightIndex };
  });

  return { neighbors, startIndex: rtl2ltr[0], endIndex: rtl2ltr[sections.length - 1] };
};
