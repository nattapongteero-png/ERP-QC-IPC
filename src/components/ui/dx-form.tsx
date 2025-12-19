"use client";

import Form, { SimpleItem, GroupItem, EmptyItem, ButtonItem, Label } from 'devextreme-react/form';
import type { FormTypes } from 'devextreme-react/form';
import validationEngine from 'devextreme/ui/validation_engine';

export interface DxFormProps {
  /** Form data object */
  formData: Record<string, unknown>;
  /** Form data change handler */
  onFormDataChange?: (formData: Record<string, unknown>) => void;
  /** Field change handler */
  onFieldDataChanged?: (e: FormTypes.FieldDataChangedEvent) => void;
  /** Number of columns in form layout */
  colCount?: number | 'auto';
  /** Responsive column count */
  colCountByScreen?: { xs?: number; sm?: number; md?: number; lg?: number };
  /** Label location */
  labelLocation?: 'left' | 'top';
  /** Label mode for editors */
  labelMode?: 'static' | 'floating' | 'hidden' | 'outside';
  /** Show colon after label */
  showColonAfterLabel?: boolean;
  /** Show required mark */
  showRequiredMark?: boolean;
  /** Required mark */
  requiredMark?: string;
  /** Optional mark */
  optionalMark?: string;
  /** Show optional mark */
  showOptionalMark?: boolean;
  /** Show validation summary */
  showValidationSummary?: boolean;
  /** Validation group name */
  validationGroup?: string;
  /** Read-only mode */
  readOnly?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Scroll to first error on submit */
  scrollToFirstError?: boolean;
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Additional CSS class */
  className?: string;
  /** Form content */
  children: React.ReactNode;
  /** Reference to Form component for accessing methods */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formRef?: React.RefObject<any>;
}

/**
 * DevExtreme Form wrapper for structured form layouts
 *
 * @example
 * ```tsx
 * const [formData, setFormData] = useState({ name: '', email: '', type: '' });
 *
 * <DxForm
 *   formData={formData}
 *   onFormDataChange={setFormData}
 *   colCount={2}
 *   labelLocation="top"
 *   validationGroup="itemForm"
 * >
 *   <DxFormItem dataField="name" label="ชื่อ" required />
 *   <DxFormItem dataField="email" label="อีเมล" editorType="dxTextBox" editorOptions={{ mode: 'email' }} />
 *   <DxFormGroup caption="รายละเอียด" colCount={1}>
 *     <DxFormItem dataField="description" label="คำอธิบาย" editorType="dxTextArea" />
 *   </DxFormGroup>
 * </DxForm>
 * ```
 */
export function DxForm({
  formData,
  onFormDataChange,
  onFieldDataChanged,
  colCount = 1,
  colCountByScreen,
  labelLocation = 'top',
  labelMode = 'floating',
  showColonAfterLabel = false,
  showRequiredMark = true,
  requiredMark = '*',
  optionalMark = '(ไม่บังคับ)',
  showOptionalMark = false,
  showValidationSummary = false,
  validationGroup,
  readOnly = false,
  disabled = false,
  scrollToFirstError = true,
  width,
  height,
  className,
  children,
  formRef,
}: DxFormProps) {
  const handleFieldDataChanged = (e: FormTypes.FieldDataChangedEvent) => {
    if (onFormDataChange && e.dataField) {
      onFormDataChange({
        ...formData,
        [e.dataField]: e.value,
      });
    }
    if (onFieldDataChanged) {
      onFieldDataChanged(e);
    }
  };

  return (
    <Form
      ref={formRef}
      formData={formData}
      onFieldDataChanged={handleFieldDataChanged}
      colCount={colCount}
      colCountByScreen={colCountByScreen}
      labelLocation={labelLocation}
      alignItemLabels
      alignItemLabelsInAllGroups
      showColonAfterLabel={showColonAfterLabel}
      showRequiredMark={showRequiredMark}
      requiredMark={requiredMark}
      optionalMark={optionalMark}
      showOptionalMark={showOptionalMark}
      showValidationSummary={showValidationSummary}
      validationGroup={validationGroup}
      readOnly={readOnly}
      disabled={disabled}
      scrollingEnabled={scrollToFirstError}
      width={width}
      height={height}
      className={className}
      labelMode={labelMode}
    >
      {children}
    </Form>
  );
}

// Re-export form item components
export { SimpleItem as DxFormItem, GroupItem as DxFormGroup, EmptyItem as DxFormEmpty, ButtonItem as DxFormButton, Label as DxFormLabel };

// Utility function to validate a form group
export function validateFormGroup(groupName: string): boolean {
  const result = validationEngine.validateGroup(groupName);
  return result.isValid ?? false;
}

// Utility function to reset validation for a group
export function resetFormValidation(groupName: string): void {
  validationEngine.resetGroup(groupName);
}
