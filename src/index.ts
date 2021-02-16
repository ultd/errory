import ErrorStackParser, { StackFrame } from 'error-stack-parser'
import { vsprintf } from 'sprintf-js'
import c from 'ansi-colors'

interface Opts {
	/**
	 * locationInMessage - option appends the location where the error was created
	 *
	 * @default false
	 *
	 * @example
	 * ```
	 * // Error: this is an error message (/Users/projects/project-a/location/to/where/error/called.ts:3:33)
	 * ````
	 */
	locationInMessage: boolean
	/**
	 * locationAsRelativePath - sets location in message as relative path from where file was executed
	 *
	 * @default false
	 *
	 * @example
	 * ```
	 * // Error: this is an error message (location/to/where/error/called.ts:3:33)
	 * ```
	 */
	locationAsRelativePath: boolean
	/**
	 * typeInMessage - appends the error type to the error's message
	 *
	 * @default false
	 *
	 * @example
	 * ```
	 * // Error: this is an error message --AuthError
	 * ```
	 */
	typeInMessage: boolean
	/**
	 * typePreceedingChars - allows you to set the preceeding char(s) of the error type in message
	 *
	 * @default --
	 *
	 * @example
	 * ```
	 * let opts = {
	 *      typePreceedingChars: '##'
	 * }
	 * const error = Errory.buildConstructor({ AuthError: {}}, opts)
	 * const err = error('this is an error message').type('AuthError')
	 *
	 * console.log(err.toString())
	 * // Error: this is an error message ##AuthError
	 *
	 * ```
	 */
	typePreceedingChars: string
	/**
	 * wrappedErrorInMessage - appends wrapped error to the error message on a new line
	 *
	 * @default true
	 *
	 * @example
	 * ```
	 * const err = error('could not authenticate', new Error('Bad credentials')).type('AuthError')
	 *
	 * console.log(err.toString())
	 * // Error: this is an error message --AuthError (src/routes/login.ts:33:3)
	 * //     => Error: Bad credentials (src/controllers/login.ts:35:5)
	 * //         => Error: Password mismatch (src/models/users.ts:44:10)
	 * ```
	 */
	wrappedErrorInMessage: boolean
}

export type Options = Partial<Opts>

type ContextValueType = 'string' | 'number' | 'boolean'

interface ContextShape {
	[key: string]: ContextValueType
}

type Context<T extends ContextShape> = {
	readonly [key in keyof T]?: T[key] extends 'string'
		? string
		: T[key] extends 'number'
		? number
		: T[key] extends 'boolean'
		? boolean
		: never
}

interface ErrorTypesDefinition {
	[key: string]: ErrorTypeConfig
}

interface ErrorTypeConfig {
	context: ContextShape
}

interface ErroryInternal<ETD extends ErrorTypesDefinition, T extends keyof ETD | undefined> {
	name: string
	message: string
	stack: string
	context: { [key: string]: string | number | boolean }
	type: T
	typeIsInMessageString: boolean
	stackFrames: StackFrame[]
	args: any[]
	wrappedError: Error | null
	toFormattedString: (
		typeInMessage: boolean,
		typePreceedingChars: string,
		locationInMessage: boolean,
		locationAsRelativePath: boolean,
		wrappedErrorInMessage: boolean,
		indent: number
	) => string
}

export const buildError = <ETD extends ErrorTypesDefinition>(
	errorTypes: ETD,
	opts: Options = {}
) => {
	const setupErrorTypes = (errorTypes: ETD): ETD => {
		const defaultErrorTypeConfig: ErrorTypeConfig = {
			context: {},
		}

		let _errorTypes: any = {}
		for (const type in errorTypes) {
			_errorTypes[type] = Object.assign({}, defaultErrorTypeConfig, errorTypes[type])
		}
		return _errorTypes
	}

	type Errory<T extends keyof ETD | undefined> = Error & {
		readonly context: T extends keyof ETD
			? {
					[key in keyof ETD[T]['context']]?: ETD[T]['context'][key] extends 'string'
						? string
						: ETD[T]['context'][key] extends 'number'
						? number
						: ETD[T]['context'][key] extends 'boolean'
						? boolean
						: never
			  }
			: any
	} & {
			[key in keyof ETD as `is${Capitalize<string & key>}`]: (
				err?: Errory<keyof ETD>
			) => err is Errory<key>
		} & {
			/**
			 * type - func that sets the error type and optionally allows you to set context properties
			 *
			 * @param type - string that is a type from predefined error types
			 * @param ctx - an object which should be the shape of predefined error type context
			 */
			type<E extends keyof ETD | undefined>(
				type: E,
				context?: E extends keyof ETD
					? {
							[key in keyof ETD[E]['context']]?: ETD[E]['context'][key] extends 'string'
								? string
								: ETD[E]['context'][key] extends 'number'
								? number
								: ETD[E]['context'][key] extends 'boolean'
								? boolean
								: never
					  }
					: never
			): Errory<E>
			type(): T extends keyof ETD ? T : undefined
			/**
			 * toJSON - func that converts error into JSON serialized string
			 *
			 * @param pretty - whether to format JSON in pretty format (defaults to false)
			 */
			toJSON(pretty?: boolean): string
			/**
			 * wrappedError - func that returns this error's wrapped error (if any)
			 */
			wrappedError(): Error | null
		}

	type ErroryConstructor = {
		/**
		 * Errory constructor - constructs a new Errory error from a message
		 *
		 * @param message - A string that will be the error's message.
		 * @param args - Any number of arguments used for formatting message string.
		 * 				 Optionally provide an Error object as the final argument to
		 * 				 wrap in Errory error returned.
		 */
		(message: string, ...args: [...any, Error]): Errory<any>
		/**
		 * Errory constructor - constructs a new Errory error from an existing plain Error
		 *
		 * @param error - A plain Error object to convert into an Errory error.
		 */
		(error: Error): Errory<any>

		/**
		 * is - func that asserts error is an Errory error
		 * @param err - plain Error object
		 */
		is<T extends keyof ETD>(
			error: Error,
			type?: T
		): error is T extends keyof ETD ? Errory<T> : Errory<keyof ETD>
	}

	let configuredErrorTypes = setupErrorTypes(errorTypes)

	const instanceOptions: Opts = {
		locationInMessage: false,
		locationAsRelativePath: false,
		typeInMessage: false,
		typePreceedingChars: '--',
		wrappedErrorInMessage: true,
	}

	const setInstanceOptions = (options: Options) => {
		Object.assign(instanceOptions, options)
	}

	const genLocationErrorStr = (print: boolean, stack: StackFrame, relative: boolean): string => {
		if (!print) {
			return ''
		}
		if (relative) {
			const relativeFileName = stack.fileName?.substring(
				process.cwd().length + 1,
				stack.fileName.length
			)
			return c.green(`  (${relativeFileName}:${stack.lineNumber}:${stack.columnNumber})`)
		}
		return c.green(`  (${stack.fileName}:${stack.lineNumber}:${stack.columnNumber})`)
	}

	const genTypeStr = (
		print: boolean,
		preceedingChars: string,
		type: string | undefined
	): string => {
		if (!print || !type) {
			return ''
		}
		return '  ' + c.green(`${preceedingChars}${type}`)
	}

	const genMessageStr = (fMsg: string, args: any[]): string => {
		return vsprintf(fMsg, args)
	}

	const genTypeTag = (preceedingChars: string, type: keyof ETD | undefined): string => {
		return `${preceedingChars}${type}`
	}

	function errorFactory(message: string, args: any[]): Errory<undefined> {
		let errorTypeInMessageStr: keyof ETD | undefined = undefined
		for (const errType in configuredErrorTypes) {
			if (message.includes(genTypeTag(instanceOptions.typePreceedingChars, errType))) {
				errorTypeInMessageStr = errType
			}
		}

		// create the error to use
		let err = Error() as Readonly<ErroryInternal<ETD, undefined>>

		const setProp = <EI extends ErroryInternal<ETD, any>, P extends keyof EI>(
			prop: P,
			value: EI[P]
		): void => {
			Object.defineProperty(err, `__errory__${prop}`, {
				value: value,
				configurable: true,
				writable: false,
				enumerable: false,
			})
		}

		const getProp = <T extends keyof ErroryInternal<ETD, keyof ETD>>(
			prop: T
		): ErroryInternal<ETD, keyof ETD>[T] => {
			return (err as any)[`__errory__${prop}`]
		}

		const stackFrames = ErrorStackParser.parse(err)

		// remove first 2 StackFrames as they are error and errorFactory function calls
		stackFrames.splice(0, 2)

		setProp('name', err.name)
		setProp('stack', err.stack)
		setProp('message', message)
		setProp('context', {})
		setProp('type', errorTypeInMessageStr)
		setProp('typeIsInMessageString', errorTypeInMessageStr ? true : false)
		setProp('stackFrames', stackFrames)
		setProp('args', args)
		setProp('wrappedError', null)

		// check to see if the last argument passed is of type Error, if so, remove from args and
		// assign to internal.wrappedError
		if (getProp('args').length && getProp('args')[getProp('args').length - 1] instanceof Error) {
			setProp('wrappedError', getProp('args').splice(getProp('args').length - 1, 1)[0])
		}

		const genWrappedErrorStr = (error: Error | null, indent: number) => {
			if (!error) {
				return ''
			}
			if ((error as any).__errory) {
				let indentStr = ''
				for (let i = 0; i < indent; i++) {
					indentStr += '    '
				}
				return `\n${indentStr}${c.green(' \u2B91')}   ${error.toString()}`
			}
			return `: ${error.toString()}`
		}

		const genMessage = (
			typeInMessage: boolean,
			typePreceedingChars: string,
			locationInMessage: boolean,
			locationAsRelativePath: boolean,
			wrappedErrorInMessage: boolean,
			indent: number = 0
		) => {
			const msgStr = `${genMessageStr(message, args)}${genTypeStr(
				!getProp('typeIsInMessageString') && typeInMessage,
				typePreceedingChars,
				getProp('type') as string
			)}${genLocationErrorStr(
				locationInMessage,
				getProp('stackFrames')[0],
				locationAsRelativePath
			)}${wrappedErrorInMessage ? genWrappedErrorStr(getProp('wrappedError'), indent) : ''}`
			return msgStr
		}

		setProp(
			'message',
			genMessage(
				instanceOptions.typeInMessage,
				instanceOptions.typePreceedingChars,
				instanceOptions.locationInMessage,
				instanceOptions.locationAsRelativePath,
				instanceOptions.wrappedErrorInMessage
			)
		)

		setProp(
			'toFormattedString',
			(
				typeInMessage: boolean,
				typePreceedingChars: string,
				locationInMessage: boolean,
				locationAsRelativePath: boolean,
				wrappedErrorInMessage: boolean,
				indent: number
			) => {
				return `${getProp('name')}: ${genMessage(
					typeInMessage,
					typePreceedingChars,
					locationInMessage,
					locationAsRelativePath,
					wrappedErrorInMessage,
					indent
				)}`
			}
		)

		// define is[ErrorType] function on Errory error
		for (const errType in configuredErrorTypes) {
			const errTypeCapitalized =
				errType[0].toUpperCase() + errType.split('').splice(1, errType.length).join('')
			Object.defineProperty(err, `is${errTypeCapitalized}`, {
				value: () => {
					return getProp('type') === errType
				},
				configurable: false,
				enumerable: false,
				writable: false,
			})
		}

		// set __errory to true that way it's identifiable
		Object.defineProperty(err, `__errory`, {
			value: true,
			configurable: false,
			enumerable: false,
			writable: false,
		})

		// get error stack to remove error and errorFactory func stackframes
		// and reassign to error stack
		const rebuildStack = () => {
			const errorStacks = err.stack.split('\n')
			let firstLine = errorStacks.slice(0, 1)
			firstLine[0] = c.green('\u{1F6D1}') + ` Error: ${getProp('message')}`
			const remainingStacks = errorStacks.slice(3, errorStacks.length + 1)
			const newStack = ([] as string[]).concat(firstLine, remainingStacks)
			setProp('stack', newStack.join('\n'))
		}

		rebuildStack()

		// define Errory type method
		Object.defineProperty(err, 'type', {
			value: <T extends keyof ETD>(type?: T, context?: Context<ETD[T]['context']>) => {
				if (!type && !context) {
					return getProp('type')
				}
				if (getProp('type')) {
					throw new Error('cannot call "type" method once already set!')
				}
				setProp('type', type)
				setProp('context', context as { [key: string]: string | number | boolean })
				setProp(
					'message',
					genMessage(
						instanceOptions.typeInMessage,
						instanceOptions.typePreceedingChars,
						instanceOptions.locationInMessage,
						instanceOptions.locationAsRelativePath,
						instanceOptions.wrappedErrorInMessage
					)
				)
				rebuildStack()
				return err
			},
			configurable: false,
			enumerable: false,
			writable: false,
		})

		// define Errory toJSON method
		Object.defineProperty(err, 'toJSON', {
			value: (pretty: boolean = false): string => {
				return JSON.stringify(
					{
						name: getProp('name'),
						type: getProp('type'),
						message: getProp('message'),
						context: getProp('context'),
						stack: getProp('stackFrames'),
					},
					null,
					pretty ? 2 : 0
				)
			},
			configurable: false,
			enumerable: false,
			writable: false,
		})

		// get name from errory name prop value
		Object.defineProperty(err, 'name', {
			get: () => getProp('name'),
			set: () => {},
			configurable: false,
			enumerable: false,
		})

		// get message from errory message prop value
		Object.defineProperty(err, 'message', {
			get: () => getProp('message'),
			set: () => {},
			configurable: false,
			enumerable: true,
		})

		// get stack from errory stack prop value
		Object.defineProperty(err, 'stack', {
			get: () => getProp('stack'),
			set: () => {},
			configurable: false,
			enumerable: true,
		})

		// get context from errory context prop value
		Object.defineProperty(err, 'context', {
			get: () => getProp('context'),
			set: () => {},
			configurable: false,
			enumerable: false,
		})

		// get wrappedError from errory wrappedError prop value
		Object.defineProperty(err, 'wrappedError', {
			value: () => getProp('wrappedError'),
			configurable: false,
			enumerable: false,
			writable: false,
		})

		return (err as unknown) as Errory<undefined>
	}

	setInstanceOptions(opts)
	function errorConstructor(messageOrError: string | Error, ...args: any[]): Errory<undefined> {
		if (messageOrError instanceof Error) {
			return errorFactory(messageOrError.message, [])
		}
		return errorFactory(messageOrError as string, args)
	}

	Object.defineProperty(errorConstructor, 'is', {
		value: <T extends keyof ETD>(error: Error, type?: T): error is Errory<T> => {
			if ((error as any).__errory === true) {
				if (type) {
					if ((error as any).__errory__type === type) {
						return true
					}
					return false
				}
				return true
			}
			return false
		},
		configurable: false,
		writable: false,
		enumerable: true,
	})

	return (errorConstructor as unknown) as ErroryConstructor
}

const error = buildError({
	DBError: { context: { table: 'string', column: 'string' } },
	AuthError: { context: { cookieExpired: 'boolean', credentialsIncorrect: 'boolean' } },
	SomeOtherError: { context: {} },
}, {
	locationInMessage: true,
	locationAsRelativePath: true,
	typeInMessage: true
})

type error = ReturnType<typeof error>
