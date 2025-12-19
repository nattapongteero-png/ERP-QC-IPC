import { z } from 'zod';

/**
 * DevExtreme validation callback data type
 * Used by CustomRule validationCallback
 */
interface ValidationCallbackData {
  value: unknown;
  rule: {
    message?: string;
    type: string;
    isValid?: boolean;
  };
  validator: unknown;
  column?: unknown;
  data?: unknown;
}

/**
 * Creates a DevExtreme validation callback from a Zod schema
 *
 * @example
 * ```tsx
 * <TextBox>
 *   <Validator>
 *     <CustomRule
 *       validationCallback={zodValidationCallback(
 *         z.string().email(),
 *         { customMessage: 'กรุณากรอกอีเมลที่ถูกต้อง' }
 *       )}
 *     />
 *   </Validator>
 * </TextBox>
 * ```
 */
export function zodValidationCallback<T extends z.ZodTypeAny>(
  zodSchema: T,
  options?: { customMessage?: string }
): (e: ValidationCallbackData) => boolean {
  return (e: ValidationCallbackData): boolean => {
    const result = zodSchema.safeParse(e.value);

    if (!result.success) {
      // Use Zod's error message or custom message (Zod v4 uses .issues instead of .errors)
      e.rule.message = options?.customMessage || result.error.issues[0]?.message || 'ค่าไม่ถูกต้อง';
      return false;
    }

    return true;
  };
}

/**
 * Creates a required field validator
 *
 * @example
 * ```tsx
 * <TextBox>
 *   <Validator>
 *     <CustomRule validationCallback={zodRequiredCallback('กรุณากรอกชื่อ')} />
 *   </Validator>
 * </TextBox>
 * ```
 */
export function zodRequiredCallback(message: string = 'จำเป็นต้องกรอกข้อมูลนี้') {
  return zodValidationCallback(
    z.string().min(1, message),
    { customMessage: message }
  );
}

/**
 * Creates an email validator
 */
export function zodEmailCallback(message: string = 'อีเมลไม่ถูกต้อง') {
  return zodValidationCallback(
    z.string().email(message),
    { customMessage: message }
  );
}

/**
 * Creates a phone number validator (Thai format)
 */
export function zodPhoneCallback(message: string = 'เบอร์โทรศัพท์ไม่ถูกต้อง') {
  return zodValidationCallback(
    z.string().regex(/^0[0-9]{8,9}$/, message),
    { customMessage: message }
  );
}

/**
 * Creates a number range validator
 */
export function zodNumberRangeCallback(
  min: number,
  max: number,
  message?: string
) {
  const defaultMessage = `ค่าต้องอยู่ระหว่าง ${min} ถึง ${max}`;
  return zodValidationCallback(
    z.number().min(min).max(max),
    { customMessage: message || defaultMessage }
  );
}

/**
 * Creates a positive number validator
 */
export function zodPositiveNumberCallback(message: string = 'ค่าต้องเป็นจำนวนบวก') {
  return zodValidationCallback(
    z.number().positive(message),
    { customMessage: message }
  );
}

/**
 * Creates a minimum length validator
 */
export function zodMinLengthCallback(minLength: number, message?: string) {
  const defaultMessage = `ต้องมีอย่างน้อย ${minLength} ตัวอักษร`;
  return zodValidationCallback(
    z.string().min(minLength, message || defaultMessage),
    { customMessage: message || defaultMessage }
  );
}

/**
 * Creates a maximum length validator
 */
export function zodMaxLengthCallback(maxLength: number, message?: string) {
  const defaultMessage = `ต้องมีไม่เกิน ${maxLength} ตัวอักษร`;
  return zodValidationCallback(
    z.string().max(maxLength, message || defaultMessage),
    { customMessage: message || defaultMessage }
  );
}

/**
 * Type helper for extracting Zod schema shape from an object schema
 */
export type ZodSchemaShape<T extends z.ZodObject<z.ZodRawShape>> = T['shape'];

/**
 * Creates validators from a Zod object schema
 * Returns an object with validation callbacks for each field
 *
 * @example
 * ```tsx
 * const schema = z.object({
 *   name: z.string().min(1, 'จำเป็น'),
 *   email: z.string().email('อีเมลไม่ถูกต้อง'),
 * });
 *
 * const validators = createFieldValidators(schema);
 *
 * <TextBox dataField="name">
 *   <Validator>
 *     <CustomRule validationCallback={validators.name} />
 *   </Validator>
 * </TextBox>
 * ```
 */
export function createFieldValidators<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T
): Record<keyof T['shape'], (e: ValidationCallbackData) => boolean> {
  const shape = schema.shape;
  const validators: Record<string, (e: ValidationCallbackData) => boolean> = {};

  for (const [key, fieldSchema] of Object.entries(shape)) {
    validators[key] = zodValidationCallback(fieldSchema as z.ZodTypeAny);
  }

  return validators as Record<keyof T['shape'], (e: ValidationCallbackData) => boolean>;
}
