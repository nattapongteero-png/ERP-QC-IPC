'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { Search } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  variant?: 'default' | 'search' | 'filled';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onSearch?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className = '', 
    label, 
    error, 
    id, 
    variant = 'default',
    leftIcon,
    rightIcon,
    onSearch,
    ...props 
  }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    const baseStyles = `
      block w-full transition-all duration-200 ease-in-out
      disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60
      placeholder:text-gray-400
    `;
    
    const variantStyles = {
      default: `
        px-4 py-2.5 border-2 rounded-xl
        bg-white
        border-gray-200
        hover:border-gray-300
        focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10
        ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : ''}
      `,
      search: `
        pl-11 pr-4 py-2.5 border-2 rounded-xl
        bg-gray-50
        border-gray-200
        hover:bg-white hover:border-gray-300
        focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10
      `,
      filled: `
        px-4 py-2.5 border-2 rounded-xl
        bg-gray-100
        border-transparent
        hover:bg-gray-50 hover:border-gray-200
        focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10
      `,
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onSearch) {
        onSearch();
      }
      props.onKeyDown?.(e);
    };
    
    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId} 
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {/* Left Icon or Search Icon */}
          {(leftIcon || variant === 'search') && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon || <Search className="h-5 w-5" />}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={`
              ${baseStyles}
              ${variantStyles[variant]}
              ${leftIcon && variant !== 'search' ? 'pl-11' : ''}
              ${rightIcon ? 'pr-11' : ''}
              ${className}
            `}
            onKeyDown={handleKeyDown}
            {...props}
          />
          
          {/* Right Icon */}
          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        
        {error && (
          <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// SearchInput component for convenience
interface SearchInputProps extends Omit<InputProps, 'variant' | 'leftIcon'> {
  onSearch?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onSearch, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        variant="search"
        onSearch={onSearch}
        {...props}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';
