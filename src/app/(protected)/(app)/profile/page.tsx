'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useApp } from '@/components/providers/AppClientProvider';
import { uploadProfilePhoto, changePassword, updateUserProfile } from '@/lib/auth';
import { auth } from '@/lib/firebase';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import {
  Loader2, User, KeyRound, Save, CheckCircle2, XCircle,
  Eye, EyeOff, Trash2
} from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const currentYear = new Date().getFullYear();
const validYears = [currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4].map(String);

/** SSR-safe File schema (avoids referencing window.File on the server) */
const FileSchema = typeof window === 'undefined' ? z.any() : z.instanceof(File);

const ProfileFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say'], { required_error: 'Gender is required.' }),
  graduationYear: z.string({ required_error: 'Please select your graduation year.' })
    .refine(val => validYears.includes(val), { message: 'Please select a valid graduation year.' }),
  campusArea: z.string().optional(),
  photo: FileSchema
    .optional()
    .refine((f: unknown) => !f || typeof f === 'string' || (f && typeof (f as File).size === 'number'), 'Invalid file.')
    .refine((f: unknown) => !f || (f as File).size <= MAX_FILE_SIZE, 'Max file size is 5MB.')
    .refine(
      (f: unknown) => !f || ACCEPTED_IMAGE_TYPES.includes((f as File).type as (typeof ACCEPTED_IMAGE_TYPES)[number]),
      'Only .jpg, .png, and .webp are supported.'
    ),
});
type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

const PasswordFormSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters long.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.'),
  confirmNewPassword: z.string(),
}).refine(d => d.currentPassword !== d.newPassword, {
  message: 'New password must be different from the current one.',
  path: ['newPassword'],
}).refine(d => d.newPassword === d.confirmNewPassword, {
  message: "New passwords don't match",
  path: ['confirmNewPassword'],
});
type PasswordFormValues = z.infer<typeof PasswordFormSchema>;

function PasswordRequirement({ meets, label }: { meets: boolean; label: string }) {
  return (
    <div className={cn('flex items-center text-sm', meets ? 'text-green-600' : 'text-muted-foreground')}>
      {meets ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
      {label}
    </div>
  );
}

export default function ProfilePage() {
  const { userProfile: user, refreshUserProfile } = useApp();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      gender: 'Prefer not to say',
      graduationYear: undefined,
      campusArea: '',
      photo: undefined,
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
    mode: 'onChange',
  });

  useEffect(() => {
    if (user) {
      const tokens = (user.name || '').trim().split(/\s+/).filter(Boolean);
      const firstName = tokens.length > 1 ? tokens.slice(0, -1).join(' ') : tokens[0] || '';
      const lastName = tokens.length > 1 ? tokens[tokens.length - 1] : '';

      profileForm.reset({
        firstName,
        lastName,
        gender: (user.gender as ProfileFormValues['gender']) || 'Prefer not to say',
        graduationYear: user.graduationYear ? String(user.graduationYear) : undefined,
        campusArea: user.campusArea || '',
        photo: undefined,
      });
      setPhotoPreview(user.photoUrl || null);
      setIsLoading(false);
    }
  }, [user, profileForm]);

  const isBC = user?.university === 'Boston College';

  // Track auth.currentUser reactively so hasPasswordProvider updates when auth restores
  const [firebaseUser, setFirebaseUser] = useState(auth.currentUser);
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setFirebaseUser(u));
  }, []);
  const hasPasswordProvider = firebaseUser?.providerData.some(p => p.providerId === 'password') ?? false;

  const watchedNewPassword = passwordForm.watch('newPassword');
  const passwordRequirements = useMemo(() => {
    const pass = watchedNewPassword || '';
    return [
      { label: 'At least 8 characters', meets: pass.length >= 8 },
      { label: 'Contains a lowercase letter', meets: /[a-z]/.test(pass) },
      { label: 'Contains an uppercase letter', meets: /[A-Z]/.test(pass) },
      { label: 'Contains a number', meets: /[0-9]/.test(pass) },
    ];
  }, [watchedNewPassword]);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      profileForm.setValue('photo', f, { shouldValidate: true });
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(f);
    }
  };

  const handleProfileSubmit = async (data: ProfileFormValues) => {
    if (!user) return;

    const wantsPhotoUpload = data.photo && typeof data.photo !== 'string';
    let photoUrl: string | undefined;
    let photoError: string | undefined;

    try {
      // Upload photo with a timeout so a misconfigured Storage bucket can't hang forever
      if (wantsPhotoUpload) {
        const file = data.photo as File;
        console.log('[Profile] Uploading photo:', { name: file.name, size: file.size, type: file.type, userId: user.id, hasAuthUser: !!auth.currentUser });
        try {
          photoUrl = await Promise.race([
            uploadProfilePhoto(user.id, file),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Photo upload timed out. Please try again.')), 30_000)
            ),
          ]);
          console.log('[Profile] Upload succeeded, URL:', photoUrl);
        } catch (err) {
          console.error('[Profile] Photo upload failed:', err);
          photoError = err instanceof Error ? err.message : 'Unknown upload error.';
        }
      }

      await updateUserProfile(user.id, {
        name: `${data.firstName} ${data.lastName}`.trim(),
        gender: data.gender,
        graduationYear: parseInt(data.graduationYear, 10),
        ...(isBC ? { campusArea: data.campusArea || '' } : { campusArea: '' }),
        ...(photoUrl ? { photoUrl } : {}),
      });

      if (photoError) {
        toast({
          title: 'Profile saved, but photo upload failed',
          description: photoError,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Success!', description: 'Profile updated.' });
      }

      // Refresh context in the background — don't block the save feedback
      refreshUserProfile().catch(() => {});
      if (photoUrl) setPhotoPreview(photoUrl);
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handlePasswordSubmit = async (vals: PasswordFormValues) => {
    try {
      await changePassword(vals.currentPassword, vals.newPassword);
      toast({ title: 'Password updated', description: 'You may be asked to reauthenticate later.' });
      passwordForm.reset();
    } catch (err) {
      toast({
        title: 'Password update failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      const res = await fetch('/api/account/delete', { method: 'POST', credentials: 'same-origin' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to delete account.');
      toast({ title: 'Account deleted', description: 'We’re sad to see you go.' });
      if (typeof window !== 'undefined') window.location.href = '/login?deleted=true';
    } catch (err) {
      toast({ title: 'Deletion failed', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
      setIsDeleting(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex items-center gap-3 text-lg text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="container mx-auto max-w-2xl space-y-6">
        {/* Profile header */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary">
            <AvatarImage src={photoPreview || undefined} alt={user.name || ''} />
            <AvatarFallback className="text-xl">{getInitials(user.name || undefined)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold font-headline">{user.name}</h1>
            <p className="text-sm text-muted-foreground">{user.university} &middot; Class of {user.graduationYear}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-5">
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                <h2 className="text-lg font-semibold font-headline">Edit Profile</h2>

                <div className="space-y-4">
                  <FormField
                    control={profileForm.control}
                    name="photo"
                    render={() => (
                      <FormItem>
                        <FormLabel>Photo</FormLabel>
                        <FormControl>
                          <input
                            id="photo"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            onChange={handleFileChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField name="firstName" control={profileForm.control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl><Input {...field} placeholder="First name" autoComplete="given-name" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}/>
                        <FormField name="lastName" control={profileForm.control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl><Input {...field} placeholder="Last name" autoComplete="family-name" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}/>
                      </div>

                  {isBC && (
                    <FormField
                      control={profileForm.control}
                      name="campusArea"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Campus Area</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="2k">2k</SelectItem>
                              <SelectItem value="Newton">Newton</SelectItem>
                              <SelectItem value="CoRo/Upper">CoRo/Upper</SelectItem>
                              <SelectItem value="Lower">Lower</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={profileForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                              <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="graduationYear"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Class of</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {validYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={profileForm.formState.isSubmitting}>
                  <Save className="mr-2 h-4 w-4" />
                  {profileForm.formState.isSubmitting ? 'Saving…' : 'Save Changes'}
                </Button>
              </form>
            </Form>

            <Separator className="my-6" />

            {hasPasswordProvider ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold font-headline">Change Password</h2>

                  <form onSubmit={passwordForm.handleSubmit(async (vals) => handlePasswordSubmit(vals))} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <div className="relative">
                        <Input id="currentPassword" type={showCurrentPassword ? 'text' : 'password'} {...passwordForm.register('currentPassword')} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute inset-y-0 right-0 h-full px-3"
                          onClick={() => setShowCurrentPassword(v => !v)}
                          aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                          aria-pressed={showCurrentPassword}
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                        </Button>
                      </div>
                      {passwordForm.formState.errors.currentPassword && (
                        <p className="text-destructive text-sm">{passwordForm.formState.errors.currentPassword.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Input id="newPassword" type={showNewPassword ? 'text' : 'password'} {...passwordForm.register('newPassword')} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute inset-y-0 right-0 h-full px-3"
                          onClick={() => setShowNewPassword(v => !v)}
                          aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                          aria-pressed={showNewPassword}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                        </Button>
                      </div>
                      {passwordForm.formState.errors.newPassword && (
                        <p className="text-destructive text-sm">{passwordForm.formState.errors.newPassword.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                      <div className="relative">
                        <Input id="confirmNewPassword" type={showConfirmNewPassword ? 'text' : 'password'} {...passwordForm.register('confirmNewPassword')} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute inset-y-0 right-0 h-full px-3"
                          onClick={() => setShowConfirmNewPassword(v => !v)}
                          aria-label={showConfirmNewPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                          aria-pressed={showConfirmNewPassword}
                        >
                          {showConfirmNewPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                        </Button>
                      </div>
                      {passwordForm.formState.errors.confirmNewPassword && (
                        <p className="text-destructive text-sm">{passwordForm.formState.errors.confirmNewPassword.message}</p>
                      )}
                    </div>

                    <div className="space-y-1 rounded-md border p-3 shadow-sm">
                      {passwordRequirements.map((req, i) => (
                        <PasswordRequirement key={i} meets={req.meets} label={req.label} />
                      ))}
                    </div>

                    <Button type="submit" variant="secondary" disabled={!passwordForm.formState.isValid || passwordForm.formState.isSubmitting}>
                      <KeyRound className="mr-2 h-4 w-4" />
                      {passwordForm.formState.isSubmitting ? 'Updating…' : 'Update Password'}
                    </Button>
                  </form>
                </div>
            ) : (
              <div className="space-y-1">
                <h2 className="text-lg font-semibold font-headline">Password</h2>
                <p className="text-sm text-muted-foreground">
                  Linked to Google. Manage via your Google account.
                </p>
              </div>
            )}

            <Separator className="my-6" />

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold font-headline text-destructive">Delete Account</h2>
                <p className="text-xs text-muted-foreground">Permanent and irreversible.</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isDeleting}>
                    {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</> : 'Delete'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your account and all data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive hover:bg-destructive/90">
                      Delete my account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
