import { parse, StackFrame } from 'error-stack-parser'
import { vsprintf } from 'sprintf-js'

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
	 * // Error: this is an error message --AuthError
	 * // Error: Bad credentials
	 * ```
	 */
	wrappedErrorInMessage: boolean
}

export type Options = Partial<Opts>

interface Internal<T> {
	ctx?: Ctx
	type: keyof T
	typeCalled: boolean
	typeInMessageString: boolean
	stackFrames: StackFrame[]
	message: string
	args: any[]
	wrappedError: Error | null
}

interface Ctx {
	[key: string]: number | string | boolean
}

type ContextValueType = 'string' | 'number' | 'boolean'

interface ContextShape {
	[key: string]: ContextValueType
}

type Context<T extends ContextShape> = {
	readonly [key in keyof T as key extends string ? key : never]?: T[key] extends 'string'
		? string
		: T[key] extends 'number'
		? number
		: T[key] extends 'boolean'
		? boolean
		: never
}

interface ErrorTypeConfig {
	contextShape?: ContextShape
}

interface ErrorTypesDefinition {
	[key: string]: ErrorTypeConfig
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
		return `  (${relativeFileName}:${stack.lineNumber}:${stack.columnNumber})`
	}
	return `  (${stack.fileName}:${stack.lineNumber}:${stack.columnNumber})`
}

const genTypeStr = (print: boolean, preceedingChars: string, type: string): string => {
	if (!print) {
		return ''
	}
	return `  ${preceedingChars}${type}`
}

const genWrappedErrorStr = (print: boolean, wrappedError: Error | null): string => {
	if (!print || !wrappedError) {
		return ''
	}
	return `:\n${wrappedError.toString()}`
}

const genMessageStr = (fMsg: string, args: any[]): string => {
	return vsprintf(fMsg, args)
}

const genTypeTag = (preceedingChars: string, type: string): string => {
	return `${preceedingChars}${type}`
}

export const buildError = <ETD extends ErrorTypesDefinition = ErrorTypesDefinition>(
	errorTypes: ETD,
	opts: Options
) => {
	type ErrorTypes = ETD & { UnknownError: ErrorTypeConfig }
	errorTypes = Object.assign({ UnknownError: {} }, errorTypes)

	type ContextShapeTypes = {
		[key in keyof ErrorTypes]: ErrorTypes[key]['contextShape'] extends ContextShape
			? Context<ErrorTypes[key]['contextShape']>
			: never
	}

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

	type error<T extends keyof ErrorTypes> = Error & { ctx?: ContextShapeTypes[T] } & {
			[key in keyof ErrorTypes as `is${string & key}`]: (err?: error<any>) => err is error<key>
		} & { type<T extends keyof ErrorTypes>(type: T, ctx?: ContextShapeTypes[T]): error<T> }

	function errorFactory(message: string, args: any[]): error<any> {
		let errorTypeInMessageStrFound = false
		let errorTypeInMessageStr: keyof ErrorTypes
		for (const errType in errorTypes) {
			if (message.includes(genTypeTag(instanceOptions.typePreceedingChars, errType))) {
				errorTypeInMessageStrFound = true
				errorTypeInMessageStr = errType
			}
		}

		// create the error to use
		let err = Error() as error<any>
		const stackFrames = parse(err)

		// remove first 2 StackFrames as they are error and errorFactory function calls
		stackFrames.splice(0, 2)

		const internal: Internal<ErrorTypes> = {
			type: errorTypeInMessageStrFound ? errorTypeInMessageStr! : 'UnknownError',
			typeCalled: false,
			typeInMessageString: false,
			stackFrames: stackFrames,
			message: message,
			args: args,
			wrappedError: null,
		}

		// check to see if the last argument passed is of type Error, if so, remove from args and
		// assign to internal.wrappedError
		if (args.length && args[args.length - 1] instanceof Error) {
			internal.wrappedError = args.splice(args.length - 1, 1)[0]
		}

		const genMessage = () =>
			`${genMessageStr(message, args)}${genTypeStr(
				instanceOptions.typeInMessage,
				instanceOptions.typePreceedingChars,
				internal.type as string
			)}${genLocationErrorStr(
				instanceOptions.locationInMessage,
				internal.stackFrames[0],
				instanceOptions.locationAsRelativePath
			)}${genWrappedErrorStr(instanceOptions.wrappedErrorInMessage, internal.wrappedError)}`

		err.message = genMessage()

		// define is[ErrorType] function on error
		for (const errType in errorTypes) {
			Object.defineProperty(err, `is${errType}`, {
				value: () => {
					return internal.type === errType
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
		const alterStack = () => {
			const errorStacks = err.stack!.split('\n')
			let firstLine = errorStacks.slice(0, 1)
			firstLine[0] = `Error: ${err.message}`
			const remainingStacks = errorStacks.slice(3, errorStacks.length)
			const newStack = ([] as string[]).concat(firstLine, remainingStacks)
			err.stack = newStack.join('\n')
		}

		alterStack()

		err.type = <T extends keyof ErrorTypes>(
			type: T,
			ctx?: ErrorTypes[T]['contextShape'] extends ContextShape
				? Context<ErrorTypes[T]['contextShape']>
				: never
		) => {
			if (internal.typeCalled) {
				throw new Error('cannot call "type" method once already set previously!')
			}
			internal.type = type
			internal.ctx = ctx as Ctx
			err.ctx = Object.freeze({ ...(internal.ctx as any) })
			err.message = genMessage()
			alterStack()
			internal.typeCalled = true
			return err as error<T>
		}

		return err
	}

	setInstanceOptions(opts)

	function error(message: string, ...args: [...any, Error]): error<any>
	function error(error: Error): error<any>
	function error(messageOrError: string | Error, ...args: any[]) {
		if (messageOrError instanceof Error) {
			return errorFactory(messageOrError.message, [])
		}
		return errorFactory(messageOrError as string, args)
	}

	return error
}