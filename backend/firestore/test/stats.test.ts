import { readFileSync, createWriteStream } from 'fs'
import * as http from 'http'
import * as testing from '@firebase/rules-unit-testing'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  setLogLevel,
  getDocs,
  collection,
  deleteDoc,
} from 'firebase/firestore'

let testEnv: testing.RulesTestEnvironment

beforeAll(async () => {
  // Silence expected rules rejections from Firestore SDK. Unexpected rejections
  // will still bubble up and will be thrown as an error (failing the tests).
  setLogLevel('error')

  testEnv = await initializeTestEnvironment({
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  // Delete all the FirebaseApp instances created during testing.
  // Note: this does not affect or clear any data.
  await testEnv.cleanup()

  // Write the coverage report to a file
  const coverageFile = 'firestore-coverage.html'
  const fstream = createWriteStream(coverageFile)
  await new Promise((resolve, reject) => {
    const { host, port } = testEnv.emulators.firestore!
    const quotedHost = host.includes(':') ? `[${host}]` : host
    http.get(
      `http://${quotedHost}:${port}/emulator/v1/projects/${testEnv.projectId}:ruleCoverage.html`,
      (res) => {
        res.pipe(fstream, { end: true })

        res.on('end', resolve)
        res.on('error', reject)
      }
    )
  })

  console.log(`View firestore rule coverage information at ${coverageFile}\n`)
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

describe('public stats', () => {
  beforeEach(async () => {
    // Setup: Create documents in DB for testing (bypassing Security Rules).
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'stats/foo'), {
        latest: { position: 1 },
      })
      await setDoc(doc(context.firestore(), 'stats/bar'), {
        latest: { position: 2 },
      })
    })
  })

  it('should let anyone list', async function () {
    const unauthedDb = testEnv.unauthenticatedContext().firestore()
    const authedDb = testEnv.authenticatedContext('alice').firestore()

    await assertFails(getDocs(collection(unauthedDb, 'stats')))
    await assertSucceeds(getDocs(collection(authedDb, 'stats')))
  })

  it('should not allow anyone to get', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore()
    const authedDb = testEnv.authenticatedContext('peter').firestore()

    await assertFails(getDoc(doc(unauthedDb, 'stats/foo')))
    await assertFails(getDoc(doc(authedDb, 'stats/foo')))
  })

  it('should not allow anyone to write', async () => {
    const authedDb = testEnv.authenticatedContext('alice').firestore()

    // Update is disallowed.
    await assertFails(
      setDoc(doc(authedDb, 'stats/foo'), {
        metadata: {
          description: 'Forty-two',
        },
      })
    )

    // Creation is disallowed.
    await assertFails(
      setDoc(doc(authedDb, 'stats/baz'), {
        position: 3,
      })
    )

    // Deletion is disallowed.
    await assertFails(deleteDoc(doc(authedDb, 'stats/bar')))
  })
})

describe('private data', () => {
  it('should ONLY allow users to create a room they own', async function () {
    const aliceDb = testEnv.authenticatedContext('alice').firestore()

    await assertSucceeds(
      setDoc(doc(aliceDb, 'rooms/snow'), {
        owner: 'alice',
        topic: 'All Things Snowboarding',
      })
    )
  })

  it('should not allow room creation by a non-owner', async function () {
    const aliceDb = testEnv.authenticatedContext('alice').firestore()

    await assertFails(
      setDoc(doc(aliceDb, 'rooms/boards'), {
        owner: 'bob',
        topic: 'All Things Snowboarding',
      })
    )
  })

  it('should not allow an update that changes the room owner', async function () {
    const aliceDb = testEnv.authenticatedContext('alice').firestore()

    await assertFails(
      setDoc(doc(aliceDb, 'rooms/snow'), {
        owner: 'bob',
        topic: 'All Things Snowboarding',
      })
    )
  })
})
