# errory
___
## Why did we feel the need to re-invent Javascript errors?

### Well we didn't, but before we get into that, let's understand the problem at hand.

This package helps users navigate the unknown JS world of errors. In JS, Errors are strings. In the real world, strings are not errors. They do not provide enough information to be able to have an effective course of action. this is why errory was born.

Consider the following error:

```ts
// inside findUser() in moduleA.ts:
const err = new Error('Unable to find user')

console.log(err)
/*
    Error: Unable to find user
        at Module.load (internal/modules/cjs/loader.js:863:32)
        at Function.Module._load (internal/modules/cjs/loader.js:708:14)
        at Function.executeUserEntryPoint [as runMain] (internal/modules/run_main.js:60:12)
*/

return err
```

This error message gives us very little information as to what the error really means. Did we not find the user because they don't exist? Was the user not found because of a database connection error? We have zero context.

An approach to this problem may be overloading your error message with some information such as this:

```ts
// inside findUser() in moduleA.ts:
const err = new Error(`Unable to find user - database connection failed ${databaseError}`)

console.log(err)
/*
    Error: Unable to find user - database connection failed Error: database connection ECONNRESET
        at Module.load (internal/modules/cjs/loader.js:863:32)
        at Function.Module._load (internal/modules/cjs/loader.js:708:14)
        at Function.executeUserEntryPoint [as runMain] (internal/modules/run_main.js:60:12)
*/

return err
```

This approach is better as it gives some context but what do you do with this error returned? Let's see:

```ts
// inside handler() in routerA.ts:
const err = findUser()
if (err) {
	// do something
}
```

Naturally, you'd want to log the error as well as possibly take some further action. An example may be, if user doesn't exist, create the user with the supplied username and password (as some web applications do) but that would mean understanding the context of the error with certainy. How do we do this?

An approach may be:

```ts
// inside handler() in routerA.ts:
const err = someFunc()
if (err) {
	if (err.message.includes('database connection failed')) {
		return res.status(500).send('Something went wrong, please try again later.')
	} else if (err.message.includes('user not found')) {
		// create user
		const newUser = createUser(req.body)
		return res.status(201).send(newUser)
	} else {
		return res.status(400).send('We could not process your request.')
	}
}
```

This can be come cumbesome failry quick. Also, remembering the error message text that corresponds with the context of the error to you is not scalable. This is why we created errory.


# Features 

### Install errory 

You can install errory by running: `npm install --save errory`

### Setup

Setup a new error contructor and error type:
```ts
// in myError.ts:
import { buildError } from 'errory'

export const error = buildError(
	{
		DBError: {
			contextShape: {
				dbType: 'string',
                table: 'string'
			},
		},
		AuthError: {
			contextShape: {
				invalidCredentials: 'boolean',
				invalidJWT: 'boolean',
			},
		},
		NotFoundError: {},
		ValidationError: {},
		UnexpectedError: {},
	},
	{
		typeInMessage: true,
	}
)
export type error = ReturnType<typeof error>
```

Then in anywhere in your application use the type and the error constructor:
```ts
// in someFile.ts:
import { error } from './myError'

const ensurePositiveNums = (...nums: number[]): error => {
    for(const num in nums){
        if(num < 0){
            return error('the number %i is not positive', num)
        }
    }
}

const err = ensurePositiveNums(4, 3, -5)
console.log(err)
/* 
    Error: the number -5 is not positive  --UnknownError 
        at Module.load (internal/modules/cjs/loader.js:863:32)
        at Function.Module._load (internal/modules/cjs/loader.js:708:14)
        at Function.executeUserEntryPoint [as runMain] (internal/modules/run_main.js:60:12)
*/

console.log(err.isUnknownError())
// true
